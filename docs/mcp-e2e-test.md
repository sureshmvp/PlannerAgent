# MCP end-to-end test

## 1) Prepare input JSON

Create a file named input.json with the payload below.

```json
{
  "features": [
    {
      "title": "Implement PDF invoice upload",
      "description": "Allow users to upload invoices as PDFs and store them securely in the system.",
      "stories": [
        {
          "title": "Upload invoice via web UI",
          "description": "User can choose a PDF invoice and upload it via the web interface.",
          "acceptanceCriteria": [
            "Given a logged-in user, when they select a valid PDF and click upload, then the system stores and validates the file.",
            "Given a non-PDF file, when the user attempts to upload, then the system displays a validation error."
          ],
          "estimate": 5,
          "tasks": [
            {
              "title": "Create upload UI component",
              "description": "Design and implement a drag-and-drop area or file selector.",
              "estimate": 2
            },
            {
              "title": "Develop backend endpoint",
              "description": "Create an API endpoint to receive, validate, and store the PDF invoice.",
              "estimate": 3
            },
            {
              "title": "Implement file validation",
              "description": "Ensure only PDFs within size limits are accepted.",
              "estimate": 2
            }
          ]
        },
        {
          "title": "Upload invoice via mobile app",
          "description": "Allow users to upload invoices via the mobile application.",
          "acceptanceCriteria": [
            "Given a user on the mobile app, when they select a PDF invoice and click upload, then the app sends the file to the backend and confirms success.",
            "Given no internet connection, when the user tries to upload, then the app queues the upload for later."
          ],
          "estimate": 3,
          "tasks": [
            {
              "title": "Add upload flow to mobile app",
              "description": "Integrate PDF picking and uploading in the mobile UI.",
              "estimate": 2
            },
            {
              "title": "Handle offline mode",
              "description": "Allow offline upload attempts to be stored locally and retried.",
              "estimate": 2
            }
          ]
        }
      ]
    }
  ]
}
```

## 2) Run the CLI

```bash
ops360-ai create-devops-items < input.json
```

If successful, the command prints a JSON response and includes the generated documentation file path under docs/.

## 3) Verify Azure DevOps

1. Open your Azure DevOps project.
2. Check that the following work item types were created:
   - Epic: one per feature
   - Feature: one per story
   - User Story: one per task
3. Open each work item and confirm:
   - Title and description match the input JSON.
   - Acceptance criteria and estimates are appended to the description.
4. Open the generated markdown file under docs/ and verify it lists all created items and IDs.
