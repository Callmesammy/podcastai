# Overview 

This is an Ai Podcast that converts a URL into a natural podcast audio file. 

# Core Features 

## Scape Website 
The user enters a URL and we then use Firecrawl to extract the website content.

## Generate Conversation 
The app the uses the Ai SDK vs (OpenAi gpt-5-mini as the model) to create a conversation between 2 hosts discussing the scraped content

## Generate Podcast Audio
Use the Elevenlabs SDK to generate the dialog from the conversation text.

