// Import the necessary modules
const { getRagContext, getRagResponse, insertImageRagResponse } = require("../../helpers/retrieval_augmented_generation.js");
const { getStandardOrFirstFormat, datasetHasDownload, getDownloadUrl, getDatasetDownloadAndWmsStatus } = require('../../helpers/download.js');
const { getVdbResponse, getVdbSearchResponse } = require('../../helpers/vector_database.js');
const { sendWebsocketMessage, sendWebsocketAction } = require('../../helpers/websocket.js');



const WebSocket = require('ws');
const server = new WebSocket.Server( {port : '8080'} );

// Establishes a socket connection with the client that can handle messages
server.on('connection', socket => {
    
    // Used to keep track of previous messages sent between user and ChatGPT, using the N last correspondence (user and system message) 
    socket.messages = [];
    socket.on('message', async message => {

        // Controller that decides what action to take based on the sendt action
        const data = JSON.parse(message); // The received client data from the websocket connection containing action and payload
        switch (data.action) {
            case "chatFormSubmit":
                // Extract the input text from the request body
                const userQuestion = data.payload;
                let memory = socket.messages.slice(-6);

                try {
                    // Gets the VDB relevant results which is used in the ragContext
                    const vdbResponse = await getVdbResponse(userQuestion);
                    const ragContext = await getRagContext(vdbResponse);

                    // Displays user question in chat
                    await sendWebsocketMessage('userMessage', userQuestion, socket);

                    // Sends RAG request with context and instruction
                    const fullRagResponse = await getRagResponse(userQuestion, memory, ragContext, socket);
                    await sendWebsocketAction('streamComplete', socket);

                    // Add user's question with context and ragResponse to the messages history
                    socket.messages.push(
                        { role: "user", content: userQuestion },
                        { role: "system", content: fullRagResponse },
                    );

                    // Checks for signal indicating if the chat message should include image UI, then markdown formats RAG message
                    await insertImageRagResponse(fullRagResponse, vdbResponse, socket)
                    await sendWebsocketAction('formatMarkdown', socket);
                } catch (error) {
                    // If the chat for some reason fails to complete. It outputs error message, and tries to reset chat submit form
                    console.log(`Server controller failed to send user message, retrieval of VDB results or RAG response stream: ${error}`);
                    console.log(`Server controller User message, VDB retrieval, RAG response stack trace: ${error.stack}`);
                    await sendWebsocketAction('streamComplete', socket);
                }
                
                break;

            case "searchFormSubmit":
                const query = data.payload;
                try {
                    // Searches the vector database using the query from the message payload
                    const vdbSearchResponse = await getVdbSearchResponse(query);
                    const datasetsWithDownloadAndWmsStatus = await getDatasetDownloadAndWmsStatus(vdbSearchResponse);

                    //console.log(`Vector database results:\n${Object.keys(vdbSearchResponse[0])}\n\n${Object.values(vdbSearchResponse[0])}`);
                    //console.log(`Vector database results:\n${Object.keys(datasetsWithDownloadAndWmsStatus[0])}\n\n${Object.values(datasetsWithDownloadAndWmsStatus[0])}`);

                    // Sends the VDB results to the client for display over the socket
                    await sendWebsocketMessage('searchVdbResults', datasetsWithDownloadAndWmsStatus, socket);
                } catch (error) {
                    console.log(`Server controller failed to get the VDB results, or send them to the client: ${error.message}`);
                    console.log(`Server controller VDB stack trace: ${error.stack}`);
                }
                break;
            
            case "showDataset":
                // The logic for getting the dataset WMS should be here
                try {
                    
                } catch (error) {
                    console.log(`Server controller failed to show the Dataset using its WMS: ${error}`);
                    console.log(`Server controller WMS stack trace: ${error.stack}`);
                }
                break;

            case "downloadDataset":
                const datasetUuid = data.payload.uuid;
                const chosenFormats = data.payload.selectedFormats;


                try {
                    // Double checks if the dataset is available for download using API
                    const isDownloadable = await datasetHasDownload(datasetUuid);
                    if (isDownloadable) {
                        // Sets download format to standard or next format by checking the downloads API
                        //const downloadFormats = await getStandardOrFirstFormat(datasetUuid);

                        // Gets the download url from the downloads API, and sends it to the client
                        const datasetDownloadUrl =  await getDownloadUrl(datasetUuid, chosenFormats);
                        await sendWebsocketMessage('downloadDatasetOrder', datasetDownloadUrl, socket)
                    }
                } catch (error) {
                    console.log(`Server controller failed to start download of dataset: ${error}`);
                    console.log(`Server controller start download stack trace: ${error.stack}`);
                }
                
                break;
        
            default:
                console.log(`Server controller received an invalid server action. Action: ${data.action}.`)
                console.log(`Server controller start download stack trace: ${error.stack}`);
                break;
        }

    });
});