import { Routes, Route } from "react-router-dom";

// Pages
import Homepage from "./pages/Home";
import About from "./pages/About";
import VoiceStudio from "./pages/Voice";
import Login from "./pages/Login";
import ModelConfig from "./pages/ModelConfig";
import Projects from "./pages/Projects";
import PrivateRoute from "./components/PrivateRoute";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/about" element={<About />} />
      <Route path="/voice" element={
        <PrivateRoute>
          <VoiceStudio />
        </PrivateRoute>
    } />
      <Route path="/login" element={<Login />} />
      <Route path="/projects" element={
        <PrivateRoute>
          <Projects />
        </PrivateRoute>
      } />
      <Route path="/model-config" element={<ModelConfig />} />
      <Route path="/model-config/:projectId" element={<ModelConfig />} />
    </Routes>
  );
}