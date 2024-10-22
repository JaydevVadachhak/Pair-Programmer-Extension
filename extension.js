const vscode = require("vscode");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const showdown = require('showdown');
const converter = new showdown.Converter();
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

function activate(context) {
  let currentPanel;
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pairProgrammer.codeOptimizer",
      async () => {
        vscode.window.showInformationMessage("Pair Programmer is Activated!");
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const selectedText = editor.document.getText(editor.selection);
          if (selectedText.length > 0) {
            vscode.window.showInformationMessage("Pair Programmer is Running!");
            try {
              if (currentPanel) {
                currentPanel.dispose();
              }
              currentPanel = vscode.window.createWebviewPanel(
                "pairProgrammer",
                "Pair Programmer",
                vscode.ViewColumn.Two,
                {
                  enableScripts: true,
                }
              );
              currentPanel.webview.html = getWebviewContent();
              currentPanel.onDidDispose(
                () => {
                  currentPanel = undefined;
                },
                undefined,
                context.subscriptions
              );
              const apiUrl = process.env.OPEN_AI_API_URL;
              const apiKey = process.env.OPEN_AI_SECRET_KEY;
              const requestBodyExplanations = makePromptRequest(process.env.PROMPT_EXPLANATIONS, selectedText);
              const requestBodyDebuggingSteps = makePromptRequest(process.env.PROMPT_DEBUGGING_STEPS, selectedText);
              const requestBodyCodeImprovements = makePromptRequest(process.env.PROMPT_IMPROVEMENTS, selectedText);
              const headers = {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              };
              currentPanel.webview.onDidReceiveMessage((message) => {
                if (message.command === 'triggerEvent') {
                  switch (message.callApiKey) {
                    case 'debug':
                      axios.post(apiUrl, requestBodyDebuggingSteps, { headers }).then(response => {
                        if (response.status === 200) {
                          currentPanel.webview.postMessage({
                            additionalInfo2: converter.makeHtml(response.data.choices[0].message.content),
                            success: true
                          });
                        } else {
                          currentPanel.webview.postMessage({
                            success: false
                          });
                        }
                      });
                      break;
                    case 'improve':
                      axios.post(apiUrl, requestBodyCodeImprovements, { headers }).then(response => {
                        if (response.status === 200) {
                          currentPanel.webview.postMessage({
                            additionalInfo3: converter.makeHtml(response.data.choices[0].message.content),
                            success: true
                          });
                        } else {
                          currentPanel.webview.postMessage({
                            success: false
                          });
                        }
                      });
                      break;
                    default:
                      break;
                  }
                  vscode.window.showInformationMessage(message.text);
                }
              });
              const [response1, response2, response3] = await Promise.all([
                axios.post(apiUrl, requestBodyExplanations, { headers }),
                axios.post(apiUrl, requestBodyDebuggingSteps, { headers }),
                axios.post(apiUrl, requestBodyCodeImprovements, { headers }),
              ]);
              currentPanel.webview.postMessage({
                additionalInfo1: converter.makeHtml(response1.data.choices[0].message.content),
                additionalInfo2: converter.makeHtml(response2.data.choices[0].message.content),
                additionalInfo3: converter.makeHtml(response3.data.choices[0].message.content),
                success: true
              });
            } catch (error) {
              vscode.window.showErrorMessage(
                "Pair Programmer: Found some issue, please try again! " + error.message
              );
              currentPanel.webview.postMessage({
                success: false,
              });
            }
          } else {
            vscode.window.showErrorMessage(
              "Please select some snippet to run Pair Programmer"
            );
          }
        }
      }
    )
  );
}

function getWebviewContent() {
  const htmlPath = path.join(__dirname, "webViewContent.html");
  const htmlContent = fs.readFileSync(htmlPath, "utf8");
  return htmlContent;
}

function deactivate() {
  console.log("Code Suggestions Extension is now inactive.");
}

function makePromptRequest(prompt, selectedText) {
  return {
    model: `${process.env.OPEN_AI_MODEL_NAME}`,
    messages: [
      {
        role: "user",
        content: `${prompt} ${selectedText}`,
      },
    ],
  }
}

module.exports = {
  activate,
  deactivate,
};
