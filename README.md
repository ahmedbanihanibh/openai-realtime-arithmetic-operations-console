# Realtime Arithmetic Console 

The Realtime Arithmetic Console is Next.JS App intended as an inspector and interactive API reference
for the OpenAI Realtime API. It comes packaged with two utility libraries,
[openai/openai-realtime-api-beta](https://github.com/openai/openai-realtime-api-beta)
that acts as a **Reference Client** (for browser and Node.js) and
[`/src/lib/wavtools`](./src/lib/wavtools) which allows for simple audio
management in the browser.


<img src="/readme/light.png" width="800" />

<img src="/readme/dark.png" width="800" />

# Starting the console

 This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Install it by extracting the contents of this package and using;

```shell
$ npm i
```

Start your server with:

```shell
$ npm run dev
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

It should be available via `localhost:3000`.

# Table of contents

1. [Using the console](#using-the-console)
   1. [Using a relay server](#using-a-relay-server)
1. [Realtime API reference client](#realtime-api-reference-client)
   1. [Sending streaming audio](#sending-streaming-audio)
   1. [Adding and using tools](#adding-and-using-tools)
   1. [Interrupting the model](#interrupting-the-model)
   1. [Reference client events](#reference-client-events)
1. [Wavtools](#wavtools)
   1. [WavRecorder quickstart](#wavrecorder-quickstart)
   1. [WavStreamPlayer quickstart](#wavstreamplayer-quickstart)
1. [Acknowledgements](#acknowledgements)
1. [Learn More](#learn-more)
1. [Deploy](#deploy)


# Using the console

The console requires an OpenAI API key (**user key** or **project key**) that has access to the
Realtime API. You'll be able to enter it by simply click on the api Key button. It will be saved via `localStorage` and can be
changed at any time from the UI.

To start a session you'll need to **connect**. This will require microphone access.
You can then choose between **manual** (Push-to-talk) and **vad** (Voice Activity Detection)
conversation modes, and switch between them at any time.

There are 4-functions (tools) enabled;

- `calculate_sum`: Calculates the sum of numbers. Use this tool when the user asks to add multiple numbers together, such as "What is the sum of 10 and 20?" or "Add 10, 20, and 30."
- `calculate_difference`: Calculates the difference between numbers. Use this function when the user wants to subtract numbers, e.g., "100 minus 10", "subtract 10 from 100", or "what is 100 - 10?"
- `calculate_product`: Calculates the product of numbers. Use this tool when the user asks to multiply numbers together, such as "What is 5 times 3?", "Multiply 2, 3, and 4", or "What is the product of 6 and 7?"
- `calculate_quotient`: Calculates the quotient of two numbers. Use this tool when the user asks to divide one number by another, such as "What is 100 divided by 5?", "Divide 50 by 2", or "What is the quotient of 20 and 4?". This tool checks for division by zero.


You can freely interrupt the model at any time in push-to-talk or VAD mode.

## Using a relay server

If you would like to build a more robust implementation and play around with the reference
client using your own server, we have included a Node.js [Relay Server](/relay-server/index.js).

```shell
$ npm run relay
```

It will start automatically on `localhost:8081`.

**You will need to create a `.env` file** with the following configuration:

```conf
OPENAI_API_KEY=YOUR_API_KEY
NEXT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
```

You will need to restart both your React app and relay server for the `.env.` changes
to take effect. The local server URL is loaded via [`ConsolePage.tsx`](/src/app/page.tsx).
To stop using the relay server at any time, simply delete the environment
variable or set it to empty string.

```javascript
/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';
```

This server is **only a simple message relay**, but it can be extended to:

- Hide API credentials if you would like to ship an app to play with online
- Handle certain calls you would like to keep secret (e.g. `instructions`) on
  the server directly
- Restrict what types of events the client can receive and send

You will have to implement these features yourself.

# Realtime API reference client

The latest reference client and documentation are available on GitHub at
[openai/openai-realtime-api-beta](https://github.com/openai/openai-realtime-api-beta).

You can use this client yourself in any React (front-end) or Node.js project.
For full documentation, refer to the GitHub repository, but you can use the
guide here as a primer to get started.

```javascript
import { RealtimeClient } from '/src/lib/realtime-api-beta/index.js';

const client = new RealtimeClient({ apiKey: process.env.OPENAI_API_KEY });

// Can set parameters ahead of connecting
client.updateSession({ instructions: 'You are a great, upbeat friend.' });
client.updateSession({ voice: 'alloy' });
client.updateSession({ turn_detection: 'server_vad' });
client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

// Set up event handling
client.on('conversation.updated', ({ item, delta }) => {
  const items = client.conversation.getItems(); // can use this to render all items
  /* includes all changes to conversations, delta may be populated */
});

// Connect to Realtime API
await client.connect();

// Send an item and triggers a generation
client.sendUserMessageContent([{ type: 'text', text: `How are you?` }]);
```

## Sending streaming audio

To send streaming audio, use the `.appendInputAudio()` method. If you're in `turn_detection: 'disabled'` mode,
then you need to use `.generate()` to tell the model to respond.

```javascript
// Send user audio, must be Int16Array or ArrayBuffer
// Default audio format is pcm16 with sample rate of 24,000 Hz
// This populates 1s of noise in 0.1s chunks
for (let i = 0; i < 10; i++) {
  const data = new Int16Array(2400);
  for (let n = 0; n < 2400; n++) {
    const value = Math.floor((Math.random() * 2 - 1) * 0x8000);
    data[n] = value;
  }
  client.appendInputAudio(data);
}
// Pending audio is committed and model is asked to generate
client.createResponse();
```

## Adding and using tools

Working with tools is easy. Just call `.addTool()` and set a callback as the second parameter.
The callback will be executed with the parameters for the tool, and the result will be automatically
sent back to the model.

```javascript
// We can add tools as well, with callbacks specified
         client.addTool(
          {
            name: 'calculate_sum',
            description: 'Calculates the sum of numbers. Use this tool when the user asks to add multiple numbers together, such as "What is the sum of 10 and 20?" or "Add 10, 20, and 30."',
            parameters: {
              type: 'object',
              properties: {
                values: {
                  type: 'array',
                  description: 'Array of numbers to be summed, e.g., [10, 20, 30]',
                  items: { type: 'number', description: 'A numeric value to be added' },
                },
              },
              required: ['values'],
            },
          },
          async ({ values }: { values: number[] }) => {
            const sum = values.reduce((acc, curr) => acc + curr, 0);
            return { result: sum };
          }
        );
```

## Interrupting the model

You may want to manually interrupt the model, especially in `turn_detection: 'disabled'` mode.
To do this, we can use:

```javascript
// id is the id of the item currently being generated
// sampleCount is the number of audio samples that have been heard by the listener
client.cancelResponse(id, sampleCount);
```

This method will cause the model to immediately cease generation, but also truncate the
item being played by removing all audio after `sampleCount` and clearing the text
response. By using this method you can interrupt the model and prevent it from "remembering"
anything it has generated that is ahead of where the user's state is.

## Reference client events

There are five main client events for application control flow in `RealtimeClient`.
Note that this is only an overview of using the client, the full Realtime API
event specification is considerably larger, if you need more control check out the GitHub repository:
[openai/openai-realtime-api-beta](https://github.com/openai/openai-realtime-api-beta).

```javascript
// errors like connection failures
client.on('error', (event) => {
  // do thing
});

// in VAD mode, the user starts speaking
// we can use this to stop audio playback of a previous response if necessary
client.on('conversation.interrupted', () => {
  /* do something */
});

// includes all changes to conversations
// delta may be populated
client.on('conversation.updated', ({ item, delta }) => {
  // get all items, e.g. if you need to update a chat window
  const items = client.conversation.getItems();
  switch (item.type) {
    case 'message':
      // system, user, or assistant message (item.role)
      break;
    case 'function_call':
      // always a function call from the model
      break;
    case 'function_call_output':
      // always a response from the user / application
      break;
  }
  if (delta) {
    // Only one of the following will be populated for any given event
    // delta.audio = Int16Array, audio added
    // delta.transcript = string, transcript added
    // delta.arguments = string, function arguments added
  }
});

// only triggered after item added to conversation
client.on('conversation.item.appended', ({ item }) => {
  /* item status can be 'in_progress' or 'completed' */
});

// only triggered after item completed in conversation
// will always be triggered after conversation.item.appended
client.on('conversation.item.completed', ({ item }) => {
  /* item status will always be 'completed' */
});
```

# Wavtools

Wavtools contains easy management of PCM16 audio streams in the browser, both
recording and playing.

## WavRecorder Quickstart

```javascript
import { WavRecorder } from '/src/lib/wavtools/index.js';

const wavRecorder = new WavRecorder({ sampleRate: 24000 });
wavRecorder.getStatus(); // "ended"

// request permissions, connect microphone
await wavRecorder.begin();
wavRecorder.getStatus(); // "paused"

// Start recording
// This callback will be triggered in chunks of 8192 samples by default
// { mono, raw } are Int16Array (PCM16) mono & full channel data
await wavRecorder.record((data) => {
  const { mono, raw } = data;
});
wavRecorder.getStatus(); // "recording"

// Stop recording
await wavRecorder.pause();
wavRecorder.getStatus(); // "paused"

// outputs "audio/wav" audio file
const audio = await wavRecorder.save();

// clears current audio buffer and starts recording
await wavRecorder.clear();
await wavRecorder.record();

// get data for visualization
const frequencyData = wavRecorder.getFrequencies();

// Stop recording, disconnects microphone, output file
await wavRecorder.pause();
const finalAudio = await wavRecorder.end();

// Listen for device change; e.g. if somebody disconnects a microphone
// deviceList is array of MediaDeviceInfo[] + `default` property
wavRecorder.listenForDeviceChange((deviceList) => {});
```

## WavStreamPlayer Quickstart

```javascript
import { WavStreamPlayer } from '/src/lib/wavtools/index.js';

const wavStreamPlayer = new WavStreamPlayer({ sampleRate: 24000 });

// Connect to audio output
await wavStreamPlayer.connect();

// Create 1s of empty PCM16 audio
const audio = new Int16Array(24000);
// Queue 3s of audio, will start playing immediately
wavStreamPlayer.add16BitPCM(audio, 'my-track');
wavStreamPlayer.add16BitPCM(audio, 'my-track');
wavStreamPlayer.add16BitPCM(audio, 'my-track');

// get data for visualization
const frequencyData = wavStreamPlayer.getFrequencies();

// Interrupt the audio (halt playback) at any time
// To restart, need to call .add16BitPCM() again
const trackOffset = await wavStreamPlayer.interrupt();
trackOffset.trackId; // "my-track"
trackOffset.offset; // sample number
trackOffset.currentTime; // time in track
```

# Acknowledgements

Thanks for checking out the Realtime Arithmetic Console. We hope you have fun with the Realtime API.
Special thanks to the whole Realtime API team for making this possible.


# Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

# Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
