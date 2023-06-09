import RunnerEngine from "gui/Runner/RunnerEngine";
import * as globals from "redux/globals";

import { runnerSelectNone } from "redux/actions";
import { runnerUpdateStatusText } from "redux/actions";
import { displayStoreFolderInfo } from "redux/actions";

const API_ENDPOINT = globals.getApiEndpoint();

// TODO
// This line permits any function declarations from the window.builderAPI
// as a workaround. Remove this in favour of a proper typescript-compatible
// interface. This may require modification to the electron code.
declare const window: any;

const displayAPI = window.displayAPI;
const runnerAPI = window.runnerAPI;
const backend = globals.getBackend();

export function displayMiddleware({ getState, dispatch }) {
  return function (next) {
    return function (action) {
      console.debug(action);
      switch (action.type) {
        case "display/close-settings":
          CloseSettings(dispatch);
          break;
        case "display/zoom-to-fit":
          ZoomToFit();
          break;
        case "display/get-folder-info":
          GetFolderInfo(dispatch, getState);
          break;
        case "display/delete-results":
          DeleteResults(dispatch, getState);
          break;
        default:
          break;
      }
      return next(action);
    };
  };
}

///////////////////////////////////////////////////////////////////////////////
// Middleware
///////////////////////////////////////////////////////////////////////////////

const CloseSettings = (dispatch) => {
  dispatch(runnerSelectNone());
};

const ZoomToFit = () => {
  const runner = RunnerEngine.Instance;
  runner.ZoomToFit();
};

const GetFolderInfo = async (dispatch, getState) => {
  const query: Record<string, unknown> = {
    query: "display/folderinfo",
    data: {
      content: JSON.parse(getState().display.folderinfo).foldername,
    },
  };
  const callback = (content) => {
    // Read folder contents into state
    dispatch(displayStoreFolderInfo(content["body"]));
  };
  switch (backend) {
    case "rest":
      SubmitQuery(query, dispatch, callback);
      break;
    case "electron":
      callback((await displayAPI.FolderInfo(query)) as Record<string, unknown>);
      break;
    default:
      console.error("Unknown backend: ", backend);
  }
};

const DeleteResults = async (dispatch, getState) => {
  const query: Record<string, unknown> = {
    query: "runner/deleteresults",
    data: {
      format: "Snakefile",
      content: JSON.parse(getState().display.folderinfo).foldername,
    },
  };
  const callback = (content) => {
    throw new Error("Delete Results not yet implemented");
  };
  switch (backend) {
    case "rest":
      SubmitQuery(query, dispatch, callback);
      break;
    case "electron":
      callback(
        (await runnerAPI.DeleteResults(query)) as Record<string, unknown>
      );
      break;
    default:
      console.error("Unknown backend: ", backend);
  }
};

///////////////////////////////////////////////////////////////////////////////
// Utility functions
///////////////////////////////////////////////////////////////////////////////

function SubmitQuery(query: Record<string, unknown>, dispatch, callback) {
  // POST request handler

  async function postRequest() {
    const postRequestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify(query),
    };
    console.info("Sending query: ", query);
    fetch(API_ENDPOINT + "/post", postRequestOptions)
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        dispatch(runnerUpdateStatusText("Error: " + response.statusText));
        throw response;
      })
      .then((data) => {
        if (data !== null) processResponse(data, callback);
        console.info("Got response: ", data);
      })
      .catch((error) => {
        console.error("Error during query: ", error);
      });
  }

  function processResponse(content: JSON, callback) {
    console.log("Process response: ", content);
    callback(content);
  }

  // Received query request (POST to backend server)...
  if (JSON.stringify(query) !== JSON.stringify({})) postRequest();
}
