import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./components/home";
import { Toaster } from "sonner";

function App() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
        <Toaster position="bottom-right" theme="dark" />
      </>
    </Suspense>
  );
}


export default App;
