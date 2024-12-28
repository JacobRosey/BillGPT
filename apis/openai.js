import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.GPT_API_KEY
});

async function getBillSummary(billText) {
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
            bills being introduced to congress, but are not interested in deciphering the hard to understand language used in the bills. 
            If this is a resolution, a simple summary is fine - do not state theories or concerns.
            If it is a bill, do the following: 
            Remain bipartisan. You may offer some theories as to why this bill was introduced or passed using any real-world context you are aware of,
            but be aware this bill may have been introduced up to 2 years ago. If you offer a theory on why the bill was introduced, 
            please clearly state any points regarding real-world issues this bill may be attempting to address.
            Finally, state some potential concerns with the bill. For example, how could this impact (positively or negatively) the average American citizen?
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

export default getBillSummary;