# AI Powered Profile Scraper

A modern web scraping application built with [Next.js](https://nextjs.org).

## Project Overview

AI Powered Profile Scraper is a web application that allows you to scrape data from websites using the power of Next.js and its server-side capabilities. This tool is designed to be user-friendly while providing powerful scraping functionality.

## Features

- Web page scraping with customizable selectors
- Data extraction and formatting
- Modern UI built with Next.js
- Server-side processing for efficient scraping

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage

1. Enter the URL of the website you want to scrape
2. Configure the CSS selectors for the data you want to extract
3. Run the scraper and view the results
4. Export the data in your preferred format

## Technologies Used

- [Next.js](https://nextjs.org) - React framework for building the application
- [React](https://reactjs.org) - Frontend UI library
- [Cheerio](https://cheerio.js.org) or similar - For HTML parsing and data extraction
- [Axios](https://axios-http.com) or similar - For making HTTP requests

## Project Structure

- `app/` - Next.js application files
- `components/` - Reusable React components
- `lib/` - Utility functions and scraping logic
- `public/` - Static assets

## Using your own MongoDB

The app uses MongoDB for storing profiles. By default it connects to `mongodb://localhost:27017/next-scraper` if no env var is set.

**To use your own database:**

1. **Local MongoDB**
   - Install [MongoDB Community](https://www.mongodb.com/try/download/community) or run it via Docker.
   - Create a database (e.g. `my-scraper`). MongoDB creates it on first write.
   - Copy `.env.example` to `.env.local` and set:
     ```env
     MONGODB_URI=mongodb://localhost:27017/my-scraper
     ```

2. **MongoDB Atlas (cloud)**
   - Create a cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
   - Get the connection string (Database → Connect → Drivers).
   - In `.env.local`:
     ```env
     MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
     ```

3. Restart the dev server so it uses the new `MONGODB_URI`. Collections (`profiles`, etc.) are created automatically when you scrape.

## Configuration

You can customize the scraper behavior by modifying the configuration options in the UI.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)

## Learn More

To learn more about the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://reactjs.org/docs)
- [Web Scraping Best Practices](https://www.scrapehero.com/how-to-prevent-getting-blacklisted-while-scraping/)

## Deployment

The easiest way to deploy your AI Powered Profile Scraper application is to use the [Vercel Platform](https://vercel.com/new) from the creators of Next.js.
