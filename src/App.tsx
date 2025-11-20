import { Routes, Route } from "react-router-dom";
import Homepage from "./components/Home.tsx";
import About from "./components/About.tsx";
import Login from "./components/Login.tsx";
import Mainpage from "./components/Main.tsx";
import VoiceDashboard from "./components/voice.tsx";


  
export default function App() {

  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/about" element={<About />} />
      <Route path="/login" element={<Login />} />
      <Route path="/main" element={<Mainpage />} />
      <Route path="/voice" element={<VoiceDashboard />} />
    </Routes>
  );
}