import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import StudyPlaceholder from './pages/StudyPlaceholder';

function App() {
  return (
    <BrowserRouter basename="/study">
      <div className="app">
        <Routes>
          <Route path="/" element={<StudyPlaceholder />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;