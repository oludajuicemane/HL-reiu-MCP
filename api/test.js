const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const response = await axios.get('https://services.leadconnectorhq.com/contacts/search', {
      headers: {
        'Authorization': 'Bearer pit-aaca741e-47a2-4b1e-b793-820d2621667b',
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      params: {
        locationId: '9hxHySEz2LSjRxkhuGQs',
        query: '4107172457'
      }
    });
    
    res.json({
      success: true,
      data: response.data,
      message: 'Real API call successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      response: error.response?.data
    });
  }
};
