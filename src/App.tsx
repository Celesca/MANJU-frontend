import { Routes, Route } from "react-router-dom";

// Pages
import Homepage from "./pages/Home";
import VoiceStudio from "./pages/Voice";
import Login from "./pages/Login";
import ModelConfig from "./pages/ModelConfig";
import Projects from "./pages/Projects";
import DemoPage from "./pages/DemoPage";
import PrivateRoute from "./components/PrivateRoute";
import FeaturesSection from "./pages/FeaturesSection";
import PricingSection from "./pages/Pricing";
import AboutPage from "./pages/About";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/features" element={<FeaturesSection />} />
      <Route path="/pricing" element={<PricingSection />} />
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
      <Route path="/demo/:projectId" element={
        <PrivateRoute>
          <DemoPage />
        </PrivateRoute>
      } />
    </Routes>
  );
}