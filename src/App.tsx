import { Routes, Route } from "react-router-dom";
import Homepage from "./components/core/Home.tsx";
import About from "./components/core/About.tsx";
import Login from "./components/core/Login.tsx";
import VoiceStudio from "./components/core/Voice.tsx";


  
export default function App() {

  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/about" element={<About />} />
      <Route path="/login" element={<Login />} />
      <Route path="/voice" element={<VoiceStudio />} />
    </Routes>
  );
}