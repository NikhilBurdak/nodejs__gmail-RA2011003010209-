const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = 'token.json'; // Store token after authentication

// Load client secrets from a file downloaded from the Google API Console
const credentials = JSON.parse(fs.readFileSync('credentials.json'));

// Create an OAuth2 client to authorize API access
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// Authorize access and store the token
async function authorize() {
  try {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
  } catch (err) {
    return getNewToken();
  }
}

// Get a new access token if not available or expired
async function getNewToken() {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this URL:', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code from that page here: ', async (code) => {
    rl.close();
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  });
}

// Function to fetch unread messages
async function listMessages() {
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
  });
  return res.data.messages || [];
}

// Function to send replies and label messages
async function processEmails(messages) {
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  for (const message of messages) {
    const threadId = message.threadId;
    const replies = await gmail.users.messages.list({ userId: 'me', q: `in:inbox thread:${threadId} -from:me` });

    if (!replies.data.messages || replies.data.messages.length === 0) {
      // No replies from this user, send reply
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: 'Your auto-reply message here',
          threadId: threadId,
        },
      });

      // Label the message
      await gmail.users.messages.modify({
        userId: 'me',
        id: message.id,
        requestBody: {
          addLabelIds: ['Label_You_Want_To_Add'], // Change label name here
          removeLabelIds: ['UNREAD'], // Remove unread label
        },
      });
    }
  }
}

// Main function to orchestrate the process
async function main() {
  await authorize();
  const unreadMessages = await listMessages();
  await processEmails(unreadMessages);
}

// Run the main function in a loop with random intervals
async function runLoop() {
  while (true) {
    await main();
    const randomInterval = Math.floor(Math.random() * (120 - 45 + 1)) + 45;
    await new Promise((resolve) => setTimeout(resolve, randomInterval * 1000));
  }
}

// Start the loop
runLoop().catch(console.error);
