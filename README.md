# Sistema de Controle Operacional de Pedidos

Sistema interno simples para controle de ocorrências de pedidos (cancelamentos e mudanças de endereço).

## Tecnologias Utilizadas
- **Backend:** Node.js com Express
- **Banco de Dados:** SQLite (persistência local em arquivo `pedidos.db`)
- **Frontend:** HTML5, CSS3 e JavaScript (Puro / Vanilla)

## Funcionalidades
- **Atendimento:** Registro de novas ocorrências.
- **Estoque / Expedição:** Visualização de pedidos pendentes com atualização automática (10s).
- **Histórico:** Consulta de pedidos concluídos com filtros por data e tipo.

## Pré-requisitos
- Node.js instalado (versão 14 ou superior recomendada)

## Instalação e Execução

1. Abra o terminal na pasta do projeto.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor:
   ```bash
   npm start
   ```
4. Acesse no seu navegador:
   ```
   http://localhost:3000
   ```

## Estrutura do Projeto
- `server.js`: Servidor Express e lógica do banco de dados.
- `public/`: Arquivos do frontend (HTML, CSS, JS).
- `package.json`: Configurações e dependências do projeto.
- `pedidos.db`: Arquivo do banco de dados (gerado automaticamente ao iniciar).

## Notas Técnicas
- O sistema grava a data de operação automaticamente.
- Pedidos cancelados recebem um destaque visual "NÃO ENVIAR".
- Mudanças de endereço destacam o novo endereço para a expedição.
- O status "Concluído" remove o pedido da lista operacional e o move para o histórico.
