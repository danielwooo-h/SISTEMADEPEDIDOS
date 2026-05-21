const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('pedidos.db');

db.all("PRAGMA table_info(ocorrencias)", (err, columns) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("Colunas da tabela ocorrencias:");
    columns.forEach(c => console.log(`- ${c.name} (${c.type})`));

    db.all("SELECT id, numero_pedido, tipo, subgrupo FROM ocorrencias ORDER BY id DESC LIMIT 5", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log("\nÚltimos registros:");
            console.table(rows);
        }
        db.close();
    });
});
