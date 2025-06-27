# NextBus - Barrie Transit Departure Board

A real-time transit departure board application for Barrie Transit, built with Next.js 14, TypeScript, and Tailwind CSS. This app provides live bus arrival times with an interface that matches the official Barrie Transit departure board.

![NextBus Screenshot](https://via.placeholder.com/800x400?text=NextBus+Transit+Board)

## Features

- **Real-time Departures**: Live bus arrival times using GTFS real-time data
- **Multi-Stop Support**: Add up to 15 stop codes and view combined departures
- **Official UI Design**: Matches the official Barrie Transit departure board interface
- **Auto-Refresh**: Updates every 15 seconds automatically
- **Smart Filtering**: Only shows upcoming departures (filters out departed buses)
- **Stop Validation**: Validates stop codes and provides helpful error messages
- **Responsive Design**: Works on desktop and mobile devices
- **Offline Detection**: Shows connection status and handles network issues gracefully

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Sources**: 
  - GTFS Static Data (stops, routes, schedules)
  - GTFS Real-time Data (live arrival predictions)
- **Deployment**: Optimized for Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/nextbus.git
cd nextbus
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3010](http://localhost:3010) in your browser.

## Usage

1. **Add Stop Codes**: Enter Barrie Transit stop codes (1-6 digits) in the input field
2. **View Departures**: See live departure times for all added stops in a combined table
3. **Remove Stops**: Click the "×" button next to any stop code to remove it
4. **Auto-Updates**: The app refreshes departure data every 15 seconds automatically

### Finding Stop Codes

Stop codes can be found:
- On bus stop signs throughout Barrie
- On the [official Barrie Transit website](https://www.barrie.ca/living/getting-around/transit)
- Popular stops include:
  - `1` - Downtown Barrie Terminal
  - `400` - Georgian College
  - `500` - RVH (Royal Victoria Hospital)

## API Endpoints

- `/api/gtfs-static` - GTFS static data (stops, routes, schedules)
- `/api/gtfs/TripUpdates` - Real-time trip updates and predictions

## Data Sources

- **GTFS Static**: https://www.myridebarrie.ca/gtfs/google_transit.zip
- **GTFS Real-time**: http://www.myridebarrie.ca/gtfs/GTFS_TripUpdates.pb

## Development

### Project Structure

```
src/
├── app/
│   ├── api/          # API routes
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Main page
├── components/       # React components
│   ├── TransitBoard.tsx
│   ├── LoadingSpinner.tsx
│   ├── ErrorBoundary.tsx
│   └── ConnectionStatus.tsx
├── lib/              # Utility functions
│   ├── gtfs.ts
│   └── gtfs-static.ts
└── styles/
    └── globals.css
```

### Key Components

- **TransitBoard**: Main component displaying departure times
- **LoadingSpinner**: Reusable loading indicator
- **ErrorBoundary**: Error handling and recovery
- **ConnectionStatus**: Network status monitoring

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy with default settings

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Barrie Transit for providing GTFS data
- Next.js team for the excellent framework
- Tailwind CSS for the utility-first CSS framework

## Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/yourusername/nextbus/issues) page
2. Create a new issue if your problem isn't already reported
3. Provide detailed information about the issue and steps to reproduce

---

**Note**: This is an unofficial application and is not affiliated with the City of Barrie or Barrie Transit. Transit data is provided by Barrie Transit's public GTFS feeds. 