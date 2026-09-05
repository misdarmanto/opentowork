---
name: new-employee
description: Scaffold a new employee YAML definition under config/employees/. Use when the user asks to add a new agent/employee to the project.
disable-model-invocation: true
---

Scaffold a new employee YAML definition at `config/employees/$ARGUMENTS.yaml`,
following the shape documented in the `architecture` skill under "Employee
YAML shape".

Ask the user (if not already clear from context) for: role, department,
provider/model, skills, tools needed, and success criteria — don't invent
business-specific details silently. Keep `tools: []` if none are specified
rather than guessing an integration.

After writing the file, validate it by referencing it from a workflow and
running `open-work validate`, or tell the user it needs a workflow step
referencing it to be validated.
