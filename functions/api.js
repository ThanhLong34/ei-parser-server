import express from 'express';
import ServerlessHttp from "serverless-http";
import axios from 'axios';
import { XMLParser } from "fast-xml-parser";
import cors from 'cors';

const app = express();

app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*',
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const parser = new XMLParser();

app.get('/.netlify/functions/api', (req, res) => {
  return res.json({
    message: "Hello"
  })
})

app.post('/.netlify/functions/api', async (req, res) => {
  try {
    const { body } = req
    
    const parcelUrl = body['parcelUrl']
    const sessionId = body['sessionId']
    const parcelIds = body['parcelIds']
    
    if (!body || !parcelUrl || !sessionId || !parcelIds) {
      return res.status(400).send('Required: parcelUrl, sessionId, parcelIds')
    }
    
    const apisMap = []
    
    if (Array.isArray(parcelIds)) {
      parcelIds.forEach((parcelId) => {
        const url = `${parcelUrl}`
        apisMap.push([url, {
          'SessionID': sessionId,
          'ParcelID': parcelId,
        }])
      })
    }
    
    const response = await Promise.all(apisMap.map(async ([url, params]) => {
      try {
        const xmlRes = await axios.get(url, { params })
        const dataParsed = parser.parse(xmlRes.data)
        
        const fileInfo = dataParsed['FileInfo']
        const contentBase64 = fileInfo['ContentBase64String']
        
        let contentDecoded = 'Not found content to parse !!!'
        
        if (fileInfo && contentBase64) {
          const buffer = Buffer.from(contentBase64, 'base64');
          contentDecoded = buffer.toString('utf8');
        }
        
        return {
          ...dataParsed,
          contentDecoded,
        }
      } catch (err) {}
    }));
    
    res.json(response.filter(i => i));
  } catch (error) {
    console.error('Error calling the API:', error);
    res.status(500).send('Error fetching data from API');
  }
});


const handler = ServerlessHttp(app);

module.exports.handler = async (event, context) => {
  return await handler(event, context);
}