import { Suspense, lazy } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { Button } from "./components/ui/Button";
import { EmptyState, Spinner } from "./components/ui/States";
import { AppLayout } from "./layouts/AppLayout";
import AboutPage from "./pages/AboutPage";
import AnalyzerPage from "./pages/AnalyzerPage";
const BatchPage = lazy(() => import("./pages/BatchPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
import HistoryPage from "./pages/HistoryPage";
import LandingPage from "./pages/LandingPage";
const ModelInfoPage = lazy(() => import("./pages/ModelInfoPage"));

export default function App() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="analyze" element={<AnalyzerPage />} />
        <Route path="batch" element={<BatchPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="model" element={<ModelInfoPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<EmptyState title="Page not found" message="That page doesn't exist." action={<Link to="/"><Button>Go home</Button></Link>} />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
