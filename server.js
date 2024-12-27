// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import getSummarizedBill from './legiscan.js';

const app = express();
const port = 6969;

app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/get-existing-summaries', async (req, res) => {
    try {
        const { billId } = req.body;
        let doc_id;
        // Ensure file exists before reading it
        const billFilePath = `./summaries/bill-${billId}.txt`;
        if (fs.existsSync(billFilePath)) {
            // Read the doc_id from the bill file
            doc_id = fs.readFileSync(billFilePath, 'utf8'); // Ensure we remove extra whitespace

            // Construct the path for the doc file and read it
            const summaryFilePath = path.join('./summaries', `doc-${doc_id}.txt`);
            
            if (fs.existsSync(summaryFilePath)) {
                const summaryContent = fs.readFileSync(summaryFilePath, 'utf8');
                return res.status(200).json({ summary: summaryContent });
            } 
        } else {
            // If the bill file doesn't exist, return a response indicating this
            return res.status(200).json({ message: 'Bill file not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error processing request' });
    }
});


app.post('/get-doc-id', async (req, res) => {
    try {
        const { billId } = req.body;
        if (fs.existsSync(`./summaries/bill-${billId}`)) {
            return res.status(200).send('Bill already summarized');
        } 
        const stream = fs.createReadStream('./csv_files/document_ids.csv')
            .pipe(csv());
        for await (const row of stream) {
            if(billId > row.billId){
                //May not work if csv is not parsed in order... i think it is though
                res.status(400).send(`Legiscan does not have bill text for bill id ${billId}`)
                return;
            }
            if (billId == row.bill_id) {
                fs.writeFile(`./summaries/bill-${billId}.txt`, row.document_id, function (err) {
                    if (err) {
                        return res.status(500).send('Error saving the summarized bill');
                    }
                });
                res.status(200).send(JSON.stringify(Number(row.document_id))) 
            }
        }
    }catch (error) {
        console.error(error)
        res.status(400).send("Error occured in get-doc-id")
    }
})

// Handle requests for bill summaries
app.post('/summarize-bill', async (req, res) => {
    try {
        const { docId } = req.body;

        if (!docId) {
            // not sure how this would occur but might as well make sure
            return res.status(400).send(JSON.stringify('Doc ID is required'));
        }

        const summary = await getSummarizedBill(docId)
        // Save the summary to a file
        fs.writeFile(`./summaries/doc-${docId}.txt`, summary.content, function (err) {
            if (err) {
                return res.status(500).send('Error saving the summarized bill');
            }
            // respond with the actual bill text here (summary.content)
            res.status(200).send(JSON.stringify(summary));
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.post('/get-bill-data', async (req, res) => {
    try {
        let billsArr = []
        const { rowStart, rowEnd } = req.body;
        let currentRow = 0;

        const stream = fs.createReadStream('./csv_files/bill_titles.csv')
            .pipe(csv());

        // This becomes increasingly inefficient as we read deeper into the csv
        // i.e. if rowStart is 10,000, we have to skip 9,999 rows until we reach 
        // the rows we care about. Should just load csv rows into main memory so we
        // can use array indices for O(1) access. A real application would just use 
        // a database but I don't want to. CSV should be good enough here 
        // as there are only ~20k rows
        for await (const row of stream) {
            if (currentRow >= rowStart) {
                let bill = {
                    id: row.bill_id,
                    title: row.title
                };
                billsArr.push(bill);

                // Check if we've reached the end row
                if (currentRow >= rowEnd) {
                    break;
                }
            }
            currentRow++;
        }
        console.log(billsArr)
        res.status(200).send(JSON.stringify(billsArr))
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving bill data')
    }
})

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
