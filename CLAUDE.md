# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 14 React application called "Plate App" - a 96/384-well plate editor. The application uses TypeScript and includes drag-and-drop functionality via @dnd-kit/core.

## Development Commands

- **Start development server**: `npm run dev`
- **Build for production**: `npm run build`
- **Start production server**: `npm start`
- **Run linter**: `npm run lint`
- **Type checking**: Run `npx tsc --noEmit` (no dedicated script in package.json)

## Architecture

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with strict configuration
- **Styling**: CSS with CSS custom properties (CSS variables)
- **Drag & Drop**: @dnd-kit/core for interactive functionality
- **Structure**:
  - `app/` - Next.js app directory with file-based routing
  - `app/layout.tsx` - Root layout component
  - `app/page.tsx` - Main application component (plate editor)
  - `app/globals.css` - Global styles and CSS variables

## CSS Architecture

The application uses a simple CSS architecture with:
- CSS custom properties defined in `:root` for colors (`--border`, `--muted`, `--accent`, `--green`)
- Box-sizing set to border-box globally
- Minimal global styles for links and buttons

## TypeScript Configuration

- Strict TypeScript configuration
- ES2022 target with modern module resolution
- Next.js plugin integration for enhanced TypeScript support
- No JavaScript files allowed (`allowJs: false`)

## Key Dependencies

- **Next.js**: React framework
- **@dnd-kit/core**: Drag and drop functionality for the plate editor
- **React 18**: Latest React with concurrent features

## Development Notes

- The application appears to be focused on laboratory plate editing functionality
- Uses modern Next.js App Router patterns
- Minimal external dependencies - keeps the bundle size small
- CSS-first approach for styling rather than CSS-in-JS or component libraries