import Image from "next/image";
import { ConsolePage } from "./(main)/(pages)/console/ConsolePage";

/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * NEXT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */

const LOCAL_RELAY_SERVER_URL: string =
  process.env.NEXT_APP_LOCAL_RELAY_SERVER_URL || '';



export default function Home() {
  return (
    <div className="flex flex-col w-full h-full" >
    <ConsolePage LOCAL_RELAY_SERVER_URL={LOCAL_RELAY_SERVER_URL} />
    </div>
  );
}
