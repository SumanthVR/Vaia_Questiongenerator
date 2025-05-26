import { mergeQuestionsWithAI } from './openai';
// Function to test the Hugging Face integration
export async function testOpenAI() {
  try {
    console.log('Testing Hugging Face integration...');
    console.log('Environment variables available:', {
      VITE_OPENAI_API_KEY: !!import.meta.env.VITE_OPENAI_API_KEY,
      NODE_ENV: import.meta.env.MODE
    });
    
    const result = await mergeQuestionsWithAI(
      'GRI',
      'SASB',
      'How does your organization report on greenhouse gas emissions?',
      'What metrics do you use to track water consumption?',
      'Environmental Impact'
    );
    
    console.log('Hugging Face test successful!');
    console.log('Result:', result);
    return result;
  } catch (error) {
    console.error('Hugging Face test failed:', error);
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Check for specific error types
      if (error.message.includes('API key')) {
        console.error('This appears to be an API key issue. Please check your API key format and permissions.');
      } else if (error.message.includes('network')) {
        console.error('This appears to be a network issue. Please check your internet connection.');
      } else if (error.message.includes('rate limit')) {
        console.error('You have hit a rate limit with the API.');
      }
    }
    
    throw error;
  }
}