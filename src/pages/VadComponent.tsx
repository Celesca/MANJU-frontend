import React, { useEffect, useMemo, useState } from "react";
import { useMicVAD, utils } from "@ricky0123/vad-react";

export const CallCenter = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<string | null>(null);
  const forceScript = true;
  const [vadStateLogKey, setVadStateLogKey] = useState(0);

  const vad = useMicVAD({
    // If set to true, it will try to start immediately (may fail if no user interaction yet)
    startOnLoad: false,
    // Choose model explicitly to avoid the hook attempting to load a different default
    model: 'v5',
    // Explicit getStream helps ensure we always request the mic in a predictable way
    getStream: async () => {
      return await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    },
    // Triggered when speech starts
    onSpeechStart: () => {
      setMessages((prev) => [...prev, "Speech detected..."]);
    },

    // Triggered when speech ends
    onSpeechEnd: (audio) => {
      setMessages((prev) => [...prev, "Speech ended."]);

      // 'audio' is a Float32Array of PCM samples.
      // We can encode it to a WAV file for playback or upload.
      const wavBuffer = utils.encodeWAV(audio);
      const blob = new Blob([wavBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      setAudioURL(url);
    },

    // Triggered if the VAD misfires (detects speech but it's too short)
    onVADMisfire: () => {
      setMessages((prev) => [...prev, "VAD Misfire (noise ignored)"]);
    },

    // Point to CDN versions that include the required runtime files
    // Use a vad-web release that matches available dist files and a recent onnxruntime-web
    // Prefer local model/worklet in `public/vad/` so the app can serve them directly
    workletURL: '/vad/vad.worklet.bundle.min.js',
    modelURL: '/vad/silero_vad_v5.onnx',
    baseAssetPath: '/vad/',
    // Keep ONNX runtime on CDN to avoid Vite import issues for .mjs/.wasm
    onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
    // Some browsers/environments have issues with AudioWorklet; allow ScriptProcessor fallback
    processorType: forceScript ? 'ScriptProcessor' : 'auto',
  });

  useEffect(() => {
    setVadStateLogKey((key) => key + 1);
  }, [vad.listening, vad.loading, vad.userSpeaking, vad.errored]);

  const vadStateSnapshot = useMemo(
    () => ({
      listening: vad.listening,
      loading: vad.loading,
      errored: vad.errored,
      userSpeaking: vad.userSpeaking,
    }),
    [vad.listening, vad.loading, vad.errored, vad.userSpeaking]
  );

  useEffect(() => {
    setMessages((prev) => [
      ...prev,
      `VAD state change: listening=${vadStateSnapshot.listening}, loading=${vadStateSnapshot.loading}, errored=${vadStateSnapshot.errored}`,
    ].slice(-20));
  }, [vadStateLogKey]);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Silero VAD (ONNX Runtime)</h1>
      
      <div style={{ marginBottom: "20px" }}>
        {vad.loading ? (
          <p>Loading VAD models...</p>
        ) : vad.errored ? (
          <p style={{ color: "red" }}>Error loading VAD</p>
        ) : (
          <p style={{ color: "green" }}>
            VAD is <strong>{vad.listening ? "Active" : "Inactive"}</strong>
          </p>
        )}
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={async () => {
              setLocalError(null);
              console.log('VAD state before toggle', { vad });
              try {
                // Try to toggle; wrap in try/catch to surface errors
                await vad.toggle();
              } catch (err) {
                console.error('Error while toggling VAD', err);
                setLocalError(String(err));
                setMessages((m) => [...m, `Toggle error: ${String(err)}`]);
              }
            }}
            disabled={vad.loading}
          >
            {vad.listening ? 'Stop Listening' : 'Start Listening'}
          </button>

          <button
            onClick={async () => {
              setLocalError(null);
              try {
                const status = await navigator.permissions?.query?.({ name: 'microphone' as PermissionName });
                setMicPermission(status?.state ?? null);
              } catch (e) {
                // ignore if permissions API not available
                setMicPermission(null);
              }
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach((t) => t.stop());
                setMessages((m) => [...m, 'Microphone permission granted (via getUserMedia)']);
                setMicPermission('granted');
              } catch (err) {
                console.error('getUserMedia error', err);
                setLocalError(String(err));
                setMessages((m) => [...m, `getUserMedia error: ${String(err)}`]);
                setMicPermission('denied');
              }
            }}
          >
            Request Microphone
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Status:</h3>
        {/* 'userSpeaking' is a boolean reacting to current speech state */}
        {vad.userSpeaking ? (
          <div style={{ 
            padding: "10px", 
            backgroundColor: "#90ee90", 
            borderRadius: "5px",
            display: "inline-block" 
          }}>
            🗣️ User is Speaking
          </div>
        ) : (
          <div style={{ 
            padding: "10px", 
            backgroundColor: "#eee", 
            borderRadius: "5px",
            display: "inline-block" 
          }}>
            🤫 Silence
          </div>
        )}
      </div>

      <div>
        <h3>Last Recorded Audio:</h3>
        {audioURL && <audio controls src={audioURL} />}
      </div>

      <div style={{ marginTop: "20px", border: "1px solid #ccc", padding: "10px" }}>
        <h3>Status:</h3>
        <pre style={{ background: '#f7f7f7', padding: 10, borderRadius: 4 }}>
          Listening: {String(vadStateSnapshot.listening)}
          {'  '}
          Loading: {String(vadStateSnapshot.loading)}
          {'  '}
          Errored: {String(vadStateSnapshot.errored)}
          {'  '}
          User speaking: {String(vadStateSnapshot.userSpeaking)}
        </pre>
        {localError && <div style={{ color: 'red' }}>Error: {localError}</div>}
        {vad.errored && <div style={{ color: 'red' }}>VAD errored: {String(vad.errored)}</div>}
        {micPermission && <div>Microphone permission: {micPermission}</div>}
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {messages.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CallCenter;