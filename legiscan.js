import PDFParser from 'pdf2json'
import OpenAI from "openai";
import { JSDOM } from 'jsdom';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config()

const legi_key = process.env.LEGI_API_KEY;
const gpt_key = process.env.GPT_API_KEY;

const openai = new OpenAI({
  apiKey: process.env.GPT_API_KEY
});

async function callOpenAI(billText) {
  const completion = openai.chat.completions.create({
    model: "gpt-4o-mini",
    store: true,
    messages: [{
      "role": "developer",
      "content": [
        {
          "type": "text",
          "text": `
            You are a helpful assistant that reads US congress bills/resolutions and returns a brief, yet thorough summary. 
            Use simpler, more easily understood language when possible. Your users are people who wish to be informed of
            bills being introduced to congress, but are not interested in deciphering the hard to understand language involved. 
            If this is a resolution, a simple summary is fine - do not state theories or concerns.
            If it is a bill, do the following: 
            Remain bipartisan. You may offer some theories as to why this bill was introduced or passed using any real-world context you are aware of,
            but be aware this bill may have been introduced up to 2 years ago. If you offer a theory on why the bill was introduced, 
            please make sure you state clear points about the real-world issues this bill may be attempting to address.
            Finally, state some potential concerns with effects the bill could have. For example, how could this impact (positively or negatively) the average American citizen?
          `
        }
      ]
    },
      { "role": "user", 
        "content": `Please provide a summary/outline of this US congress bill. 
        Use a bullet point structure, and make sure to include the names of any important
        people or organizations mentioned within. If provided in the text, please denote the party and state affiliations 
        of the key individuals by appending the information (for example, (D-TX) for democrat from texas or (R-NY) for republican from new york) 
        to their names. Use full names rather than "Mr. LastName" when possible. Do not output a preamble, such as "sure, here is the summary". 
        Here is the bill text: ${billText}` },
    ],
  });
  return completion.then((result) => result.choices[0].message);
}

async function getBillData(docId) {
  const options = {
      host: 'api.legiscan.com',
      port: 443,
      path: `https://api.legiscan.com/?key=${legi_key}&op=getBillText&id=${docId}`,
      method: 'GET',
      headers: {
          'Content-Type': 'application/json'
      },
      timeout: 5000
  };

  let billText = '';
  return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
              billText += chunk;
          });

          res.on('end', () => {
              try {
                  let billData = JSON.parse(billText); // Parse bill object
                  console.log("Received billData:", billData); // Log the full response data
                  resolve(billData); // Resolve promise with parsed object
              } catch (error) {
                  reject(`Error parsing JSON: ${error}`); // Reject the Promise if JSON parsing fails
              }
          });
      });

      req.on('error', (error) => {
          console.error('Request error:', error);
          reject(`Error fetching data: ${error}`);
      });

      req.on('timeout', () => {
          console.error('Request timed out');
          req.abort(); // Abort the request on timeout
          reject('Request timed out');
      });

      req.end();
  });
}


function parsePdf(b64) {
  return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(null, 1);

      pdfParser.on("pdfParser_dataReady", function (pdfData) {
          try {
              let extractedText = '';
              pdfData.Pages.forEach(page => {
                  page.Texts.forEach(textItem => {
                      const decodedText = decodeURIComponent(textItem.R[0].T);
                      extractedText += decodedText + ' ';
                  });
                  extractedText += '\n\n';
              });
              resolve(extractedText.trim());
          } catch (err) {
              reject(new Error(`Error processing PDF data: ${err.message}`));
          }
      });

      pdfParser.on("pdfParser_dataError", function (error) {
          reject(new Error(`PDF parsing error: ${error}`));
      });

      try {
          const data = Buffer.from(b64, 'base64');
          pdfParser.parseBuffer(data);
      } catch (err) {
          reject(new Error(`Error preparing PDF data: ${err.message}`));
      }
  });
}

function parseHtml(b64) {
  return new Promise((resolve, reject) => {
    try {
      const htmlContent = Buffer.from(b64, 'base64').toString('utf-8');
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;
      
      // Remove scripts and styles
      const scripts = document.getElementsByTagName('script');
      const styles = document.getElementsByTagName('style');
      Array.from(scripts).forEach(script => script.remove());
      Array.from(styles).forEach(style => style.remove());
      
      let text = document.body.textContent || '';
      text = text.replace(/\s+/g, ' ').trim();
      
      const paragraphs = text.split(/\n\s*\n/);
      const cleanText = paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .join('\n\n');
      
      resolve(cleanText);
    } catch (error) {
      reject(new Error(`Error parsing HTML: ${error.message}`));
    }
  });
}

// Still need to add support for .doc, .rtf, and more. check page 39 of https://legiscan.com/gaits/documentation/legiscan
async function parseDocument(b64, mimeId) {
  try {
    switch (mimeId) {
      case 1:
        return await parseHtml(b64);
      case 2:
        return await parsePdf(b64);
      default:
        throw new Error(`Unsupported file type: ${mimeId}.`);
    }
  } catch (error) {
    throw new Error(`Document parsing error: ${error.message}`);
  }
}

const getSummarizedBill = async (docId) => {
  if (!docId) {
      throw new Error('Invalid document ID provided');
  }
  
  try {
      const billData = await getBillData(docId);

      let billText;
      try {
          billText = await parseDocument(
              billData.text.doc,
              billData.text.mime_id
          );
      } catch (parseError) {
          console.error('Document parsing error details:', parseError);
          throw new Error(`Document parsing error: ${parseError.message}`);
      }

      if (!billText?.trim()) {
          throw new Error('No text extracted from document');
      }

      // Summarize
      console.log('Attempting to summarize parsed text...');
      return await callOpenAI(billText);

  } catch (error) {
      console.error('Full error details:', error);
      throw new Error(`Failed to summarize bill ${docId}: ${error.message}`);
  }
};

export default getSummarizedBill;
