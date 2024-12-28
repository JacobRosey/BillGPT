# BillGPT

**How to Use**<br>
<li>The site is hosted at placeholder.notalink.donotclick. <br>
<li>Explain the functionality of the site here <br>
<li>Find a bill title that interests you, click 'Get Summary' and wait for the summarized bill text to render in the browser. <br>

**How it Works**
<li>Uses the Legiscan API to retrieve information about US congress bills, including a pdf version of the bill itself. <br>
<li>Parses the chosen bill's pdf and sends the extracted text to the OpenAI API. <br>
<li>Renders the received summary which outlines key information in the bill. <br>

**Running BillGPT Locally** <br>
<li>After downloading and extracting the .zip, run 'sudo npm install' in the project's root directory to install required dependencies.<br> 
<li>Run 'node server.js', and open 'localhost:1776' in your web browser.<br>
<li>You will need API keys for both Legiscan and OpenAI. <br>
