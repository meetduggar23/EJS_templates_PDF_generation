# EJS Templates PDF Generation

A Node.js project for generating PDF documents using EJS templates with support for various chart types.

## Overview

This project provides utilities for creating PDF reports with embedded charts using EJS (Embedded JavaScript Templates). It supports multiple chart types including Gantt charts, scatter plots, bubble charts, and standard chart types with labels and datasets.

## Project Structure

```
EJS_templates_PDF_generation/
├── charts/              # Directory for chart-related files and configurations
├── replace.js           # Utility script for updating chart validation logic
├── package-lock.json    # NPM lock file for dependency management
└── README.md           # This file
```

## Features

- **EJS Template Support**: Generate dynamic PDF content using EJS templates
- **Multiple Chart Types**:
  - Gantt charts (requires `tasks` or `data` field)
  - Scatter and Bubble charts (requires `datasets` or `data` field)
  - Standard charts (requires `labels` and `data` or `datasets`)
- **Validation**: Built-in validation for required chart fields

## Getting Started

### Prerequisites

- Node.js (v14 or higher recommended)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/meetduggar23/EJS_templates_PDF_generation.git
   cd EJS_templates_PDF_generation
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Chart Validation

The project includes validation logic to ensure charts have the required data fields:

| Chart Type | Required Fields |
|------------|----------------|
| Gantt | `tasks` or `data` |
| Scatter/Bubble | `datasets` or `data` |
| Other charts | `labels` and (`data` or `datasets`) |

### Utility Script

The `replace.js` script updates the chart validation logic in `charts/app.js`:

```bash
node replace.js
```

This script refactors the validation code for better readability by extracting chart type checks into named variables:
- `isGantt` - Checks if chart type is 'gantt'
- `isScatterOrBubble` - Checks if chart type is 'scatter' or 'bubble'

## Repository

[GitHub Repository](https://github.com/meetduggar23/EJS_templates_PDF_generation)

## License

MIT