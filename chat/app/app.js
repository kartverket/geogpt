const socket = new WebSocket('ws://localhost:8080');


// Keeps track of the number of messages sendt, and current messageDiv to stream to
let chatMessageId = 0;
let currentSystemMessageDiv = null;
let currentUserMessageDiv = null;


// This starts off as empty, which is then updated on vector database searches to include the downloadable datasets available area, projection, format, 
// so that their download icons show if it's supported, or need selection of supported formatting
let datasetsAreaProjectionFormat = {};

socket.onopen = () => {
    // TODO remove this logging
    console.log('WebSocket connection established');


    // Initializes Kartkatalogen with vector database search 'a' for "alfabetical" first example results
    const message = {
        action : 'searchFormSubmit',
        payload : 'a',
    }
    socket.send(JSON.stringify(message)); 


};


// Listen for messages
socket.onmessage = async function (event) {
    const message = JSON.parse(event.data);

    switch (message.action) {
        case "userMessage":
            // Creates new div for the incoming user message
            currentUserMessageDiv = document.createElement('div');

            // Adds id, class, and appends it to 'chatMessages' div
            currentUserMessageDiv.id = `message-${chatMessageId}`;
            currentUserMessageDiv.classList.add('user-message');
            currentUserMessageDiv.innerHTML += message.payload;
            document.getElementById('chatMessages').appendChild(currentUserMessageDiv);

            // Incremets message id right after response received
            chatMessageId += 1;
            break;

        case "chatStream":
            // Checks if a new message div should be created with unique id
            if (message.isNewMessage) {
                // Create a new div element for the incoming system message (also updates reference to the div the stream should be sendt to)
                currentSystemMessageDiv = document.createElement('div');

                // Adds id, class, and appends it to 'chatMessages' div
                currentSystemMessageDiv.id = `message-${chatMessageId}`;
                currentSystemMessageDiv.classList.add('system-message');
                document.getElementById('chatMessages').appendChild(currentSystemMessageDiv);

                // Incremets message id right after response received
                chatMessageId += 1;
            }

            // If the new systemMessage div has been created, stream is initialized
            if (currentSystemMessageDiv) {
                currentSystemMessageDiv.innerHTML += message.payload;
            }

            // Formats new message payload from markdown into html
            //customMarkdownConversion(currentSystemMessageDiv.id);
            break;

        case "streamComplete":
            // Reactivates the submit button
            document.getElementById('chatSubmitButton').disabled = false;
            document.getElementById('chatSubmitButton').className = 'message-button';
            break;

        case "insertImage":
            // Formats new message markdown contents into html
            customMarkdownImageConversion(currentSystemMessageDiv.id, message.payload.datasetImageUrl, message.payload.datasetDownloadUrl);
            break;

        case "formatMarkdown":
            // Formats new message markdown contents into html
            customMarkdownConversion(currentSystemMessageDiv.id);
            break;

        case "searchVdbResults":
            const results_div = document.getElementById('results');
            const results = message.payload;

            // Building the entire HTML in one go
            const htmlContent = results.map(result => {
                let hasWmsUrl = result.wmsUrl;
                const hasDownloads = result.downloadFormats.length > 0;
                console.log("The app says hasWmsUrl is: " + hasWmsUrl)
                let buttonsHTML = '';
                if (hasWmsUrl !== 'None') {
                    buttonsHTML += `<div class="show-dataset pointer" data-uuid="${result.uuid}" data-type="show" onclick="replaceIframe('${hasWmsUrl}')">
            <i class="fa-solid fa-map-location-dot show-dataset-icon pointer"></i>
            <span class="show-dataset-text">Vis</span>
        </div>`;
                }

                if (hasDownloads) {
                    buttonsHTML += `<div class="download-dataset" data-uuid="${result.uuid}" data-type="download">
            <i class="fa-solid fa-cloud-arrow-down download-dataset-icon pointer"></i>
            <span class="download-dataset-text">Last ned</span>
        </div>`;
                }

                return `
        <div class="result-item" dataset-uuid="${result.uuid}">
            <a href="https://kartkatalog.geonorge.no/metadata/${result.title}/${result.uuid}" target="_blank">
                ${result.title}
            </a>
            <div class="result-buttons">
                ${buttonsHTML}
            </div>
        </div>
    `;
            }).join('');

            results_div.innerHTML = htmlContent;

            // Add event listeners to the parent container to handle all child button clicks
            results_div.addEventListener('click', function (event) {
                const target = event.target.closest('div[data-uuid]');
                if (!target) return;

                const uuid = target.dataset.uuid;
                const type = target.dataset.type;

                if (type === 'show') {
                    showDatasetWMS(uuid);
                } else if (type === 'download') {
                    downloadDataset(uuid);
                }
            });

            // If necessary, update any other UI components
            updateDownloadFormats();
            break;

        case "downloadDatasetOrder":
            window.open(message.payload, '_blank');
            break;

        default:
            console.log(`Invalid action.`)
    }

};

socket.onerror = (error) => {
    // TODO remove this logging
    console.error('WebSocket error:', error);
};


// Function for dynamically displaying filters on search
function filterFunction() {
    let input, filter, div, a, i;
    input = document.getElementById("searchFilter");
    filter = input.value.toUpperCase();
    div = document.getElementById("filterDropdown");
    a = div.getElementsByTagName("a");
    let isInputEmpty = input.value.trim() === '';

    // If there's no input, hide all links. Otherwise, follow the existing show/hide logic.
    for (i = 0; i < a.length; i++) {
        if (isInputEmpty) {
            a[i].style.display = "none";
        } else {
            let txtValue = a[i].textContent || a[i].innerText;
            a[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
        }
    }

    // Show the dropdown content when there's input, hide it when there's none.
    div.style.display = isInputEmpty ? "none" : "block";
}

function updateDownloadFormats() {
    // Gets formating form field values
    const selectedArea = document.getElementById('searchDownloadArea').value;
    const selectedProjection = document.getElementById('searchDownloadProjection').value;
    const selectedFormat = document.getElementById('searchDownloadFormat').value;

    // Iterate over result items to check if they should be updated
    document.querySelectorAll('.result-item').forEach(resultItem => {
        const uuid = resultItem.getAttribute('dataset-uuid');
        const dataset = datasetsAreaProjectionFormat[uuid];

        // Checks if the result item is in datasetsAreaProjectionFormat (is downloadable), and thus require it to be updated on area, projection and format changes
        if (dataset) {
            // Find if there is a match for area, projection, and format (it can be downloaded with selected options)
            const isSupported = dataset.some(area => {
                const areaMatch = area.name === selectedArea;
                const projectionAndFormatMatch = area.projections.some(proj =>
                    proj.name === selectedProjection && proj.formats.some(fmt => fmt.name === selectedFormat)
                );
                return areaMatch && projectionAndFormatMatch;
            });

            // Adds or removes alert icon based on if the dataset can be downloaded, or is not supported in the selected formatting
            updateDownloadAlertIcon(resultItem, isSupported);
        }
    });
}

function updateDownloadAlertIcon(element, isSupported) {
    // Gets the area with show and download icons
    const downloadSection = element.querySelector('.download-dataset');
    let icon = downloadSection.querySelector('.extra-icon');

    // Updates to include/remove alert icon based on if the formatting is supported or not for the dataset
    if (!isSupported) {
        // Add the icon if it's not already there
        if (!icon) {
            icon = document.createElement('i');
            icon.className = 'fa-solid fa-exclamation-circle extra-icon';
            downloadSection.appendChild(icon);

            downloadSection.onclick = () => openModalDownloadFormats();
        }
    } else {
        // Remove the icon if it exists
        if (icon) {
            const uuid = element.getAttribute('dataset-uuid');
            console.log(`Added download function with uuid: ${uuid}`);
            icon.remove();
            // Adds back the 
            downloadSection.onclick = () => downloadDataset(uuid);
        }
    }
}

function openModalDownloadFormats() {
    alert("Dette datasettet er ikke tilgjengelig i denne formateringen.");
}


// Function that updates map WMS
async function showDatasetWMS(uuid) {
    console.log(`Show dataset: ${uuid}`);

    const message = {
        action: 'showDataset',
        payload: uuid
    };
    socket.send(JSON.stringify(message));
}

// Function that starts download action
function downloadDataset(uuid) {
    console.log(`Download dataset: ${uuid}`);
    // Should be updated to include user selected area, projection, format etc
    const areaName = document.getElementById('searchDownloadArea').value;
    const projectionName = document.getElementById('searchDownloadProjection').value;
    const selectedFormatName = document.getElementById('searchDownloadFormat').value;

    const selectedUserGroup = document.getElementById('searchDownloadUserGroup').value;
    const selectedUsagePurpose = document.getElementById('searchDownloadUsagePurpose').value;


    // Gets the area object for the chosen area
    let areaObject = datasetsAreaProjectionFormat[uuid].find(area => area.name === areaName);
    const areaCode = areaObject.code;
    const areaType = areaObject.type;

    // Gets the projection object for the chosen area
    let projectionObject = areaObject.projections.find(projection => projection.name === projectionName);
    const projectionCode = projectionObject.code;
    const projectionCodespace = projectionObject.codespace;

    // Checks if the standard format "FGDB" does not exist, set the standard format to the first list element
    let formatObject = projectionObject.formats.find(format => format.name === selectedFormatName);
    const formatName = formatObject.name;
    const formatCode = "";
    const formatType = "";


    const message = {
        action: 'downloadDataset',
        payload: {
            uuid: uuid,
            selectedFormats: {
                areaCode: areaCode,
                areaName: areaName,
                areaType: areaType,
                projectionCode: projectionCode,
                projectionName: projectionName,
                projectionCodespace: projectionCodespace,
                formatCode: formatCode,
                formatName: formatName,
                formatType: formatType,
                userGroup: selectedUserGroup,
                usagePurpose: selectedUsagePurpose,
            },
        },
    };
    socket.send(JSON.stringify(message));
}


// Markdown formatting function
function customMarkdownImageConversion(elementId, imageUrl, downloadUrl) {
    let element = document.getElementById(elementId);
    if (!element) return;

    // Sets download icon to insert empty if dataset has no download option, otherwise updates with icon
    let downloadIcon = ``;
    if (downloadUrl !== false) { // DownloadIcon is never used...
        downloadIcon = `
            <a href="${downloadUrl}" target="_blank">
                <div class="download-card-button">
                    <i class="fa-solid fa-cloud-arrow-down card-icon"></i>Last ned
                </div> 
            </a>
        `;
    }
    let htmlContent = element.innerHTML;

    // TODO replace the <a> download link to be when the button is clicked on the client side, to submit with uuid from icon, and selected formatting options
    // Html with image and formatting UI
    let replacementHtml = `
        <div class="card-image-container"> 
            <img src="${imageUrl}" alt="Bilde" width="100%"/> 
            <div class="show-card-button">
                <i class="fa-solid fa-map-location-dot card-icon"></i>Vis
            </div> 
            <a href="${downloadUrl}" target="_blank">
                <div class="download-card-button">
                    <i class="fa-solid fa-cloud-arrow-down card-icon"></i>Last ned
                </div> 
            </a>
        </div>
        <div>
            <form>
            </form>
        </div>
        `;
    /*
    Should be added above
    <div class="formats-dropdown">
        Format dropdown here
    </div>
    */
    htmlContent = htmlContent.replace(/\[bilde\]/g, replacementHtml);

    element.innerHTML = htmlContent;
}

// Formats the message markdown into html after stream is complete
function customMarkdownConversion(elementId) {
    let element = document.getElementById(elementId);
    if (element) {
        let htmlContent = element.innerHTML;

        // Headers
        //htmlContent = htmlContent.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        //htmlContent = htmlContent.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        //htmlContent = htmlContent.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        //htmlContent = htmlContent.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
        //htmlContent = htmlContent.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
        //htmlContent = htmlContent.replace(/^###### (.*$)/gim, '<h6>$1</h6>');

        htmlContent = htmlContent.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');

        // Bold
        htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic
        htmlContent = htmlContent.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Strikethrough
        htmlContent = htmlContent.replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Blockquotes
        htmlContent = htmlContent.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

        // Inline Code
        htmlContent = htmlContent.replace(/`(.*?)`/g, '<code>$1</code>');

        // Links
        //htmlContent = htmlContent.replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>');

        // Horizontal Rules
        htmlContent = htmlContent.replace(/^(-{3,}|\*{3,}|_{3,})$/gim, '<hr />');

        // Unordered Lists (simple conversion, not handling nested lists)
        htmlContent = htmlContent.replace(/^\+ (.*$)/gim, '<ul>\n<li>$1</li>\n</ul>');
        htmlContent = htmlContent.replace(/^\* (.*$)/gim, '<ul>\n<li>$1</li>\n</ul>');
        htmlContent = htmlContent.replace(/^- (.*$)/gim, '<ul>\n<li>$1</li>\n</ul>');

        // Ordered Lists (simple conversion, not handling nested lists)
        htmlContent = htmlContent.replace(/^\d+\. (.*$)/gim, '<ol>\n<li>$1</li>\n</ol>');

        element.innerHTML = htmlContent;
    }
}




