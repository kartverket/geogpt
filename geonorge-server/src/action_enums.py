from enum import Enum

class Action(Enum):
    """
    Enum defining all available actions for WebSocket communication.
    Standardizes action types between client and server.
    """

    # Chat related actions
    CHAT_FORM_SUBMIT = "chatFormSubmit"
    USER_MESSAGE = "userMessage"
    FORMAT_MARKDOWN = "formatMarkdown"
    STREAM_COMPLETE = "streamComplete"

    # Search related actions
    SEARCH_FORM_SUBMIT = "searchFormSubmit"
    SEARCH_VDB_RESULTS = "searchVdbResults"

    # Dataset related actions
    CHAT_DATASETS = "chatDatasets"
    SHOW_DATASET = "showDataset"
    DOWNLOAD_DATASET = "downloadDataset"
    DOWNLOAD_DATASET_ORDER = "downloadDatasetOrder"
    UPDATE_DATASET_WMS = "updateDatasetWms"