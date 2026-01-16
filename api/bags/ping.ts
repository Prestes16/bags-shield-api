import allowCors from '../../lib/cors.js';

const handler = async (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Bags Shield API is running', 
    timestamp: Date.now() 
  });
};

export default allowCors(handler);