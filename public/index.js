// Set up global variables
let page = 0;
const billsPerPage = 20;
const billListElement = document.getElementById('billList');
const loadingElement = document.getElementById('loading');

var billIdArr = [];
var docIdArr = [];

// Check if bill has already been summarized (should know if summary exists when receiving from backend)
// and if so change button to 'view summary' and render it
async function fetchBills(page) {
  loadingElement.style.display = 'block';
  try {
    const rowStart = (page * billsPerPage);
    const response = await fetch('http://localhost:6969/get-bill-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rowStart: rowStart, rowEnd: rowStart + billsPerPage - 1 }),
    });

    const bills = await response.json();
    for (const bill of bills) { 
      const summarized = await isSummarized(bill.id);

      const billItem = document.createElement('div');
      billItem.setAttribute('id', bill.id);
      billItem.classList.add('bill-item');

      const billContent = document.createElement('div');
      billContent.classList.add('bill-content');

      const titleSpan = document.createElement('span');
      titleSpan.textContent = bill.title;

      const button = document.createElement('button');
      if (!summarized) {
        button.textContent = 'Summarize';
        button.onclick = () => summarizeBill(bill.id);
      } else {
        button.textContent = 'View Summary';
        button.style.backgroundColor = 'green';
        button.onclick = () => renderSummary(bill.id, summarized);
      }

      billContent.appendChild(titleSpan);
      billContent.appendChild(button);

      const summaryItem = document.createElement('div');
      summaryItem.classList.add('summary-item');

      billItem.appendChild(billContent);
      billItem.appendChild(summaryItem);

      // Ensure the parent element exists
      document.querySelector('.bill-list').appendChild(billItem);
      billIdArr.push(bill.id); // Add bill ID, not the whole bill object
    }

    loadingElement.style.display = 'none';
  } catch (error) {
    console.error('Error fetching bills:', error);
    loadingElement.textContent = 'Error loading bills';
  }
}

// Lazy load more bills when scrolling
billListElement.addEventListener('scroll', () => {
  if (billListElement.scrollTop + billListElement.clientHeight >= billListElement.scrollHeight) {
    // Fetch more bills if scrolled to the bottom
    loadingElement.style.display = 'block';
    page += 1;
    fetchBills(page);
  }
});

// Function to simulate summarizing a bill with ChatGPT
async function fetchDocId(billId) {
  try {
    const response = await fetch('http://localhost:6969/get-doc-id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ billId })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch docId');
    }
    return await response.text();
  } catch (error) {
    console.error('Error fetching docId:', error);
    throw error;  // Rethrow to allow higher-level error handling
  }
}

async function isSummarized(billId){
  try {
    const response = await fetch('http://localhost:6969/get-existing-summaries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ billId: billId }),
    });

    if (!response.ok) {
      console.error(response);
    }

    const data = await response.json(); // Use json() instead of text() here
    return data.message ? null : data.summary;
  } catch (err) {
    console.error(err);
  }
}

async function summarizeBillText(docId) {
  try {
    const response = await fetch('http://localhost:6969/summarize-bill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ docId })
    });

    if (!response.ok) {
      throw new Error('Failed to summarize bill');
    }

    const textResponse = await response.text();
    try {
      console.log(textResponse);
      return JSON.parse(textResponse); // Parse as JSON
    } catch (jsonError) {
      console.error('Error parsing JSON:', jsonError);
      throw jsonError;
    }
  } catch (error) {
    console.error('Error summarizing bill:', error);
    throw error;
  }
}

async function summarizeBill(billId) {
  const bill = document.getElementById(billId);
  const btn = bill.querySelector('button');
  btn.disabled = true;
  btn.style.backgroundColor = '#cc5500';
  btn.innerHTML = "Processing...";

  try {
    const docId = await fetchDocId(billId);
    if (docId === 'Bill already summarized') {
      return alert(docId);
    }

    const result = await summarizeBillText(docId);

    if (typeof result === 'object') {
      renderSummary(billId, result.content);
    } else {
      alert(result); // Do better error handling here
    }
  } catch (error) {
    console.error('Error occurred in summarizeBill:', error);
  }
}

function renderSummary(id, content) {
  const bill = document.getElementById(id);
  const summaryItem = bill.querySelector('.summary-item');
  const btn = bill.querySelector('button');
  const billList = document.querySelector('.bill-list'); // The scrollable container

  // Overwrite previous click listener
  btn.onclick = () => hideSummary(id);

  btn.innerHTML = 'Hide Summary';
  btn.style.backgroundColor = '#9B59B6';

   // Scroll the .bill-list container to bring the summary into view
   const billPosition = bill.offsetTop; 
 
   // Smoothly scroll the container
   billList.scrollTo({
     top: billPosition - 185,
     behavior: 'smooth',
   });

  if (bill) {
    summaryItem.classList.add('show');
    summaryItem.innerHTML = convertMarkdownToHtml(content);
  }

  btn.disabled = false;
}

function convertMarkdownToHtml(text) {
  return text.split('\n').map(line => {
    // Convert "**Text**" to "<strong>Text</strong>"
    line = line.replace(/^### (.*)/, '<h3>$1</h3>');
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return line
  }).join('<br>');
}

function hideSummary(id) {
  const bill = document.getElementById(id);
  const summaryItem = bill.querySelector('.summary-item');
  const btn = bill.querySelector('button');

  btn.innerHTML = 'View Summary';
  btn.style.backgroundColor = 'green';

  // Add the event listener for showing the summary again
  btn.onclick = () => renderSummary(id, summaryItem.innerHTML);

  if (summaryItem) {
    summaryItem.classList.remove('show');
  }
}


// Fetch bills on page load
fetchBills(page);
