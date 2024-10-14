import express from 'express';
import bodyParser from 'body-parser'
import cors from 'cors';

import routes from './routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});