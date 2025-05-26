import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Add error handling for root element
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

// Add error boundary
const root = createRoot(rootElement);

// Wrap the app in a try-catch for better error handling
try {
  root.render(<App />);
} catch (error) {
  console.error("Error rendering app:", error);
  root.render(
    <div style={{ padding: '20px', color: 'red' }}>
      <h1>Something went wrong</h1>
      <p>Please check the console for more details</p>
    </div>
  );
}
