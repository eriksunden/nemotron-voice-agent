// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState, type ComponentProps } from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import { PipecatClientProvider, PipecatClientAudio } from "@pipecat-ai/client-react";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import { WebSocketTransport, ProtobufFrameSerializer } from "@pipecat-ai/websocket-transport";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, useDeployment, useIceServers, type TransportType } from "./api";
import { AppProvider } from "./context/AppContext";
import { useApp } from "./context/useApp";
import { Header } from "./components/Header";
import { StatusPanel } from "./components/status-panel";
import { Sidebar } from "./components/Sidebar";
import { CenterPanel } from "./components/content";

const EMPTY_ICE_SERVERS: RTCIceServer[] = [];
const DEFAULT_AUDIO_INPUT_SAMPLE_RATE = 16000;
const DEFAULT_AUDIO_OUTPUT_SAMPLE_RATE = 22050;
type ProviderClient = ComponentProps<typeof PipecatClientProvider>["client"];
type MobileView = "settings" | "main" | "status";

// On narrow screens only one of the three panels is shown at a time.
const MOBILE_VIEWS: { id: MobileView; label: string }[] = [
  { id: "settings", label: "SETTINGS" },
  { id: "main", label: "AGENT" },
  { id: "status", label: "STATUS" },
];

type ClientSessionProps = {
  iceServers: RTCIceServer[];
  onClientReset: () => void;
  playerSampleRate: number;
  recorderSampleRate: number;
  selectedTransport: TransportType;
};

function ClientSession({
  iceServers,
  onClientReset,
  playerSampleRate,
  recorderSampleRate,
  selectedTransport,
}: Readonly<ClientSessionProps>) {
  const { currentSessionId } = useApp();
  const [mobileView, setMobileView] = useState<MobileView>("main");
  const [client] = useState(() => {
    if (selectedTransport === "websocket") {
      return new PipecatClient({
        transport: new WebSocketTransport({
          serializer: new ProtobufFrameSerializer(),
          recorderSampleRate,
          playerSampleRate,
        }),
        enableMic: true,
        enableCam: false,
        enableScreenShare: false,
      });
    }
    return new PipecatClient({
      transport: new SmallWebRTCTransport({ iceServers }),
      enableMic: true,
    });
  });

  return (
    <PipecatClientProvider client={client as unknown as ProviderClient}>
      <div className="app-shell h-screen d-flex flex-col overflow-hidden">
        <Header onClientReset={onClientReset} />
        <nav className="mobile-view-switcher" aria-label="Panels">
          {MOBILE_VIEWS.map((view) => (
            <button
              key={view.id}
              data-view={view.id}
              className={`tab-btn ${mobileView === view.id ? "active" : ""}`}
              aria-pressed={mobileView === view.id}
              onClick={() => setMobileView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </nav>
        <div className={`app-panels mobile-view-${mobileView} flex-1 min-h-0 d-flex overflow-hidden`}>
          <StatusPanel />
          <CenterPanel />
          <Sidebar />
        </div>
        <PipecatClientAudio key={currentSessionId || "idle"} />
      </div>
    </PipecatClientProvider>
  );
}

function AppInner() {
  const { selectedTransport } = useApp();
  const { data: deployment, isFetched: deploymentLoaded } = useDeployment();
  const { data: iceConfig, isFetched: iceServersLoaded } = useIceServers();
  const iceServers = iceConfig?.iceServers ?? EMPTY_ICE_SERVERS;
  const recorderSampleRate = deployment?.audio?.input_sample_rate ?? DEFAULT_AUDIO_INPUT_SAMPLE_RATE;
  const playerSampleRate = deployment?.audio?.output_sample_rate ?? DEFAULT_AUDIO_OUTPUT_SAMPLE_RATE;
  const [clientGeneration, setClientGeneration] = useState(0);
  const resetClient = useCallback(() => {
    setClientGeneration((generation) => generation + 1);
  }, []);

  if (
    (selectedTransport === "websocket" && !deploymentLoaded) ||
    (selectedTransport !== "websocket" && !iceServersLoaded)
  ) {
    return <div className="h-screen d-flex items-center justify-center">Loading connection...</div>;
  }

  return (
    <ClientSession
      key={`${selectedTransport}-${clientGeneration}`}
      iceServers={iceServers}
      onClientReset={resetClient}
      playerSampleRate={playerSampleRate}
      recorderSampleRate={recorderSampleRate}
      selectedTransport={selectedTransport}
    />
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
