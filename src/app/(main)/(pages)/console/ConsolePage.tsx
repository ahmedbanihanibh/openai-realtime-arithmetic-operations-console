'use client'
import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '@/lib/wavtools/index.js';
import { instructions } from '@/utils/conversation_config.js';
import { WavRenderer } from '@/utils/wav_renderer';

import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button2 } from '@/components/button/Button';
import { Toggle } from '@/components/toggle/Toggle';
 
import './ConsolePage.scss';
 import { ModeToggle } from '@/components/ui/mode-toggle';
import { ChevronDown, FileText, Maximize, Minimize2, Settings, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipDemo } from '@/components/ui/tooltip-demo';
import { AnimatePresence, motion } from 'framer-motion';



/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}


 
type Props = {
  LOCAL_RELAY_SERVER_URL : string;
};

 

export function ConsolePage({LOCAL_RELAY_SERVER_URL}: Props) {

// State variables for managing the visibility of sheets (modals)
const [isLogsSheetOpen, setIsLogsSheetOpen] = useState(false);
const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);

  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */


let apiKey = '';

if (typeof window !== 'undefined') {
  apiKey = LOCAL_RELAY_SERVER_URL
    ? ''
    : localStorage.getItem('tmp::voice_api_key') ||
      prompt('OpenAI API Key') ||
      '';
  
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }
}


  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
   const startTimeRef = useRef<string>(new Date().toISOString());


  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
 

  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  
const [isLogOpened, setIsLogOpened] = useState(false);

const [isMaximized, setIsMaximized] = useState(false);
 
 const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);


 

// Function to open the logs sheet
const openLogsPanel = () => {
  setIsLogOpened(!isLogOpened);
  setIsLogsSheetOpen(!isLogsSheetOpen); // Opens the logs sheet modal
};

// Function to open the settings sheet
const openSettingsSheet = () => {
  setIsSettingsSheetOpen(true); // Opens the settings sheet modal
};

  /**
   * When you click the API key
   */
  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
       },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
 

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

 




  /**
  Auto Scrolling for the Conversation lists 
   */
  
   const latestMessageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (latestMessageRef.current) {
      latestMessageRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [items]);
  



 /**
  Auto Scrolling for the Events lists 
   */


   const latestEventRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (latestEventRef.current) {
      latestEventRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [realtimeEvents,isLogsSheetOpen]);

 



const startRecording = async () => {
  setIsRecording(true);
  const client = clientRef.current;
  const wavRecorder = wavRecorderRef.current;
  const wavStreamPlayer = wavStreamPlayerRef.current;
  
  try {
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => {
      if (client.isConnected()) {
        client.appendInputAudio(data.mono);
      } else {
        console.error("RealtimeAPI is not connected");
      }
    });
  } catch (error) {
    console.error("Error during recording: ", error);
    setIsRecording(false);
  }
};
  /**
   * In push-to-talk mode, stop recording
   */
const stopRecording = async () => {
  setIsRecording(false);
  const client = clientRef.current;
  const wavRecorder = wavRecorderRef.current;

  try {
    await wavRecorder.pause();

    if (client.isConnected()) {
      client.createResponse();
    } else {
      console.error("RealtimeAPI is not connected. Unable to create response.");
    }
  } catch (error) {
    console.error("Error during stopping recording: ", error);
  }
};


  /**
   * Switch between Manual <> VAD mode for communication
   */
  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
  };






 
  

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    // Set instructions
    client.updateSession({ instructions: instructions });
    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    // ### Add tools ::
 

      // Add tools for arithmetic operations (sum, difference, product, quotient)
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


      client.addTool(
        {
          name: 'calculate_difference',
          description: 'Calculates the difference between numbers. Use this function when the user wants to subtract numbers, e.g., "100 minus 10", "subtract 10 from 100", or "what is 100 - 10?"',
          parameters: {
            type: 'object',
            properties: {
              values: {
                type: 'array',
                description: 'Array of numbers to subtract sequentially, e.g., [100, 10]',
                items: { type: 'number', description: 'A numeric value' },
              },
            },
            required: ['values'],
          },
        },
        async ({ values }: { values: number[] }) => {
          const difference = values.reduce((acc, curr) => acc - curr);
          return { result: difference };
        }
      );

client.addTool(
  {
    name: 'calculate_product',
    description: 'Calculates the product of numbers. Use this tool when the user asks to multiply numbers together, such as "What is 5 times 3?", "Multiply 2, 3, and 4", or "What is the product of 6 and 7?"',
    parameters: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          description: 'Array of numbers to be multiplied, e.g., [5, 3, 2]',
          items: { type: 'number', description: 'A numeric value to be multiplied' },
        },
      },
      required: ['values'],
    },
  },
  async ({ values }: { values: number[] }) => {
    const product = values.reduce((acc, curr) => acc * curr, 1);
    return { result: product };
  }
);


client.addTool(
  {
    name: 'calculate_quotient',
    description: 'Calculates the quotient of two numbers. Use this tool when the user asks to divide one number by another, such as "What is 100 divided by 5?", "Divide 50 by 2", or "What is the quotient of 20 and 4?". This tool checks for division by zero.',
    parameters: {
      type: 'object',
      properties: {
        dividend: { type: 'number', description: 'The number to be divided (the dividend)' },
        divisor: { type: 'number', description: 'The number to divide by (the divisor)' },
      },
      required: ['dividend', 'divisor'],
    },
  },
  async ({ dividend, divisor }: { dividend: number; divisor: number }) => {
    if (divisor === 0) return { error: 'Division by zero is not allowed' };
    const quotient = dividend / divisor;
    return { result: quotient };
  }
);


    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, []);



//MaximizeLogs 
const MaximizeLogs = () => {
  setIsMaximized(!isMaximized);
}




  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);


  /**
   * Render the application
   */
  return (
 <div data-component="ConsolePage" className="font-mono text-xs h-full flex flex-col overflow-hidden mx-2">
  <div className="flex flex-col h-screen">
    <header className="flex items-center justify-between p-4 border-b">
             <h1 className="text-xl font-semibold">Realtime Arithmetic Console</h1>
         
      <div className="flex items-center space-x-4">
   
       
        {/* Logs Icon */}

   
                <Button  variant={'ghost'} className={`m-4 p-2 rounded-md ${isLogOpened ? 'text-muted-foreground bg-muted hover:bg-muted hover:text-muted-foreground': 'hover:bg-muted hover:text-muted-foreground'}` } onClick={openLogsPanel}>
                  <FileText className={` w-5 h-5 stroke-[2] fill-currentColor  group mr-2 ${isLogOpened ? 'text-muted-foreground'  : ''}`}  />
                   Logs
                </Button>
        
        
        {/* API Key Button */}
        {isClient && 
         <Button className="text-xs" onClick={resetAPIKey}>
          api key: {apiKey.slice(0, 3)}...
          <Edit className="ml-2 h-4 w-4" />
        </Button>

        }
       
        {/* Mode Toggle */}
        <ModeToggle />
      </div>
    </header>



    <div className='flex flex-row gap-2 h-full overflow-y-auto mb-2 ml-2 p-4'>
         
         
      {!(isLogOpened && isMaximized) && (

        <div className='flex flex-col gap-2 flex-grow flex-1'>
           <div className="content-block-title">
                <div className='flex flex-row items-center justify-between'>
                   <h1>Conversation</h1>
                </div>
                </div>

            <div className="ml-2 p-4 flex-grow flex-1 overflow-y-auto mt-2">
            
            <div className="content-block-body" data-conversation-content>
              {!items.length && <div>awaiting connection...</div>}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}
                  ref={i === items.length - 1 ? latestMessageRef : null}
                  >
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ')}
                      </div>
                      <div
                        className="close"
                        onClick={() =>
                          deleteConversationItem(conversationItem.id)
                        }
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {/* tool response */}
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {/* tool call */}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                  '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                      {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

)}

         
   


{
  isLogsSheetOpen && 

    <div className={`flex flex-col gap-2 ${isMaximized ? 'w-full' : 'w-2/5 border-l'}`}>
       <div className={`content-block-title ${isMaximized ? '' : ''}`}>
          <div className={`flex flex-row items-center justify-between `}>
            <h1 className='ml-2'>Events</h1>

            <AnimatePresence>

                  <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }} // Add delay here

        >
        {
          !isMaximized ? (
            <TooltipDemo tooltipText='Maximize'>
                                  
                                  <Maximize className='w-5 h-5 cursor-pointer' onClick={MaximizeLogs}/>

                      </TooltipDemo>
          ) : (
            <TooltipDemo tooltipText='Minimize'>
                                  
                                  <Minimize2 className='w-5 h-5 cursor-pointer' onClick={MaximizeLogs}/>
                      </TooltipDemo>
          )
        }

          
        </motion.div>

        </AnimatePresence>

             
          </div>
        </div>
        <div className={`h-full overflow-y-auto ml-2 p-4`}>

            <div className="">
                        {!realtimeEvents.length && <div>awaiting connection...</div>}

            </div>
            <div className="content-block-body w-full">
             
             {realtimeEvents.map((realtimeEvent, i) => {
                const count = realtimeEvent.count;
                const event = { ...realtimeEvent.event };
                if (event.type === 'input_audio_buffer.append') {
                  event.audio = `[trimmed: ${event.audio.length} bytes]`;
                } else if (event.type === 'response.audio.delta') {
                  event.delta = `[trimmed: ${event.delta.length} bytes]`;
                }
                return (
                  <div className="event" key={event.event_id} ref={i === realtimeEvents.length - 1 ? latestEventRef : null}>
                    <div className="event-timestamp">
                      {formatTime(realtimeEvent.time)}
                    </div>
                    <div className="event-details">
                  <div
                        className="event-summary"
                        onClick={() => {
                          // toggle event details
                          const id = event.event_id;
                          const expanded = { ...expandedEvents };
                          if (expanded[id]) {
                            delete expanded[id];
                          } else {
                            expanded[id] = true;
                          }
                          setExpandedEvents(expanded);
                        }}
                      >
                        <div
                          className={`event-source ${
                            event.type === 'error'
                              ? 'error'
                              : realtimeEvent.source
                          }`}
                        >
                          {realtimeEvent.source === 'client' ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          )}
                          <span>
                            {event.type === 'error'
                              ? 'error!'
                              : realtimeEvent.source}
                          </span>
                        </div>
                        <div className="event-type">
                          {event.type}
                          {count && ` (${count})`}
                        </div>
                      </div>
                      {!!expandedEvents[event.event_id] && (
                        <div className="event-payload">
                          {JSON.stringify(event, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
    </div>
    </div> 

}
   



    </div>
   

     {/* Footer with Start Session and VAD/Manual Buttons */}
    <div className="p-4 border-t">
      
      <div className="flex flex-rows-3 justify-between items-center w-full">
       

       <div className='flex-none'>
           {/* VAD/Manual Toggle */}
        <Toggle
          defaultValue={false}
          labels={['manual', 'vad']}
          values={['none', 'server_vad']}
          onChange={(_, value) => changeTurnEndType(value)}
        />
       </div>
       
       
       
       
        {/* Start Session Button */}
 
        {isConnected && canPushToTalk && (
              <Button2
                label={isRecording ? 'release to send' : 'push to talk'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              />
            )}
        
        <Button2
              label={isConnected ? 'disconnect' : 'connect'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />

           <div>
            <div className="visualization">
              <div className="visualization-entry client ">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server  ">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>

            </div>  
            
      </div>


    </div>
    
  </div>

 

</div>

  );
}