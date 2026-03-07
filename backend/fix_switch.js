const fs = require('fs');
const filepath = 'd:/nap-dms.lcbp3/specs/03-Data-and-Storage/n8n.workflow.json';
const workflow = JSON.parse(fs.readFileSync(filepath, 'utf8'));

const switchNodeIndex = workflow.nodes.findIndex(n => n.name === 'Route by Confidence');

if (switchNodeIndex > -1) {
  workflow.nodes[switchNodeIndex] = {
    id: "23d11b5e-49b4-4b53-911b-76b6bb77aab8",
    name: "Route by Confidence",
    type: "n8n-nodes-base.switch",
    typeVersion: 3.2,
    position: [6840, 3696],
    parameters: {
      rules: {
        values: [
          {
            conditions: {
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
                version: 2
              },
              conditions: [
                {
                  leftValue: "={{ $json.route_index }}",
                  rightValue: 0,
                  operator: {
                    type: "number",
                    operation: "equals",
                    singleValue: true
                  }
                }
              ],
              combinator: "and"
            },
            renameOutput: true,
            outputKey: "Auto Ingest"
          },
          {
            conditions: {
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
                version: 2
              },
              conditions: [
                {
                  leftValue: "={{ $json.route_index }}",
                  rightValue: 1,
                  operator: {
                    type: "number",
                    operation: "equals",
                    singleValue: true
                  }
                }
              ],
              combinator: "and"
            },
            renameOutput: true,
            outputKey: "Review Queue"
          },
          {
            conditions: {
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
                version: 2
              },
              conditions: [
                {
                  leftValue: "={{ $json.route_index }}",
                  rightValue: 2,
                  operator: {
                    type: "number",
                    operation: "equals",
                    singleValue: true
                  }
                }
              ],
              combinator: "and"
            },
            renameOutput: true,
            outputKey: "Reject"
          },
          {
            conditions: {
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
                version: 2
              },
              conditions: [
                {
                  leftValue: "={{ $json.route_index }}",
                  rightValue: 3,
                  operator: {
                    type: "number",
                    operation: "equals",
                    singleValue: true
                  }
                }
              ],
              combinator: "and"
            },
            renameOutput: true,
            outputKey: "Error Log"
          }
        ]
      }
    }
  };

  if (workflow.connections['Confidence Router'] || workflow.connections['Route by Confidence']) {
    workflow.connections['Route by Confidence'] = {
      'main': [
        [ { 'node': 'Import to Backend', 'type': 'main', 'index': 0 } ],
        [ { 'node': 'Insert Review Queue', 'type': 'main', 'index': 0 } ],
        [ { 'node': 'Log Reject to CSV', 'type': 'main', 'index': 0 } ],
        [ { 'node': 'Log Error to CSV', 'type': 'main', 'index': 0 } ]
      ]
    };
  }

  fs.writeFileSync(filepath, JSON.stringify(workflow, null, 2));
  console.log("Updated Switch node to use typeVersion 3.2 properly.");
} else {
  console.log("Could not find Route by Confidence node.");
}
