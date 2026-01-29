
import { Providers } from "./components/Providers";
import { OpenfortButton } from "@openfort/react";

export default function App() {
  return (
    <Providers>
      {/* Your app content */}
      <h1>Openfort React Demo</h1>
      <OpenfortButton />
    </Providers>
  );
}
