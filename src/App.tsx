import { Routes, Route } from "react-router-dom";

// Pages
import Homepage from "./pages/Home";
import About from "./pages/About";
import Login from "./pages/Login";
import VoiceStudio from "./pages/Voice";
// import CallCenter from "./pages/VadComponent";
import MyComponent from "./pages/vad";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/about" element={<About />} />
      <Route path="/login" element={<Login />} />
      <Route path="/voice" element={<VoiceStudio />} />
      <Route path="/callcenter" element={<MyComponent />} />
    </Routes>
  );
}