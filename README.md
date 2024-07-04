# Crypto Token Analysis Bot for DexScreener

This project is a demonstration of a cryptocurrency token analysis bot that monitors token data from DexScreener and performs various analyses.

## Features

- Connects to DexScreener WebSocket to receive real-time token data
- Stores token data in a SQLite database
- Performs deep analysis on tokens periodically
- Generates reports based on detected signals
- Sends alerts via Telegram

## Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Create a `.env` file with your Telegram bot token and chat ID:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   ```
4. Run the bot: `npm start`

## TODO

- Improve signal detection algorithms
- Implement and test fresh signals detection
- Fine-tune analysis parameters

## Disclaimer

This is a demonstration project and should not be used for financial decisions without thorough testing and validation.

## License

MIT, do whatever you want with this code.