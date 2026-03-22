/**
 * Modulo di comunicazione per stampante fiscale Custom K3.
 * Molte stampanti fiscali moderne offrono un'interfaccia XML su connessione TCP/IP.
 * Qui simuliamo la creazione del payload XML per la stampante.
 */

export async function printFiscalReceiptCustom({ orderItems, total, paymentType, customer }) {
  console.log('--- EMISSIONE SCONTRINO FISCALE CUSTOM K3 ---');
  console.log(`Totale: ${total.toFixed(2)}€ | Pagamento in: ${paymentType}`);
  if (customer) {
    console.log(`Intestatario: ${customer.name}`);
  }

  // Esempio di Payload XML da inviare alla stampante (il tracciato varia in base al firmware)
  // Per l'implementazione reale, di solito si effettua un POST HTTP sulla porta della K3.
  
  let customerXml = '';
  if (customer) {
    customerXml += `
    <printRecMessageText>Cliente: ${customer.name}</printRecMessageText>`;
    if (customer.phone) customerXml += `
    <printRecMessageText>Tel: ${customer.phone}</printRecMessageText>`;
    if (customer.address) customerXml += `
    <printRecMessageText>Indirizzo: ${customer.address}</printRecMessageText>`;
  }

  let itemsXml = orderItems.map(item => {
    let desc = item.name;
    if (item.isFamily) {
       // Per lo scontrino fiscale inviamo 1 riga compatta col prezzo totale della famiglia
       let half1 = item.halves && item.halves[0] ? item.halves[0].name.substring(0, 10) : 'Vuota';
       let half2 = item.halves && item.halves[1] ? item.halves[1].name.substring(0, 10) : 'Vuota';
       desc = `FAM. ${half1}/${half2}`;
    } else {
       // Se ci sono molte modifiche, su K3 a volte si invia "Reparto 1" con prezzo maggiorato
       // Il totale è già in item.price
    }
    
    return `
    <printRecItem>
      <description>${desc}</description>
      <quantity>${item.quantity}</quantity>
      <unitPrice>${item.price.toFixed(2)}</unitPrice>
      <department>1</department>
    </printRecItem>
    `;
  }).join('');

  let xmlDoc = `<?xml version="1.0" encoding="utf-8"?>
<printer>
  <printRecMessage>
    ${customerXml}
    ${itemsXml}
    <printRecTotal>
      <description>Totale</description>
      <paymentType>${paymentType === 'CASH' ? 1 : 2}</paymentType>
      <amount>${total.toFixed(2)}</amount>
    </printRecTotal>
  </printRecMessage>
</printer>`;

  console.log('--- PAYLOAD XML SIMULATO DA INVIARE ---');
  console.log(xmlDoc);
  
  return new Promise((resolve) => {
    // Simuliamo un ping di rete
    setTimeout(() => {
      resolve(true);
    }, 500);
  });
}

export async function closeDayCustom() {
  console.log('--- CHIUSURA FISCALE GIORNALIERA CUSTOM K3 ---');
  // Comando per stampare la lettura Z e la Chiusura Fiscale
  let xmlClose = `<?xml version="1.0" encoding="utf-8"?>
<printer>
  <printZReport>
    <timeout>10000</timeout>
  </printZReport>
</printer>`;

  console.log('--- PAYLOAD XML CHIUSURA ---');
  console.log(xmlClose);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 500);
  });
}
