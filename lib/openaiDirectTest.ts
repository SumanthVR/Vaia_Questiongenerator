// Direct test of Hugging Face endpoint using fetch
export async function testOpenAIDirectly() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || 'hf_dummy_key';
  console.log('Testing Hugging Face endpoint directly');
  console.log('API Key available:', !!apiKey);
  
  try {
    const response = await fetch('https://nc4r71glhhp1qbx8.us-east-1.aws.endpoints.huggingface.cloud/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'tgi', // The model name for Hugging Face endpoint
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'Hello, can you help me test the API?'
          }
        ],
        max_tokens: 50
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('OpenAI direct test successful!');
    console.log('Response:', data);
    
    return data.choices[0]?.message?.content || 'No content returned';
  } catch (error) {
    console.error('OpenAI direct test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    throw error;
  }
}