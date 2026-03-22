import escpos from 'escpos';
import escposUsb from 'escpos-usb';
import escposNetwork from 'escpos-network';

// Registrazione degli adapter in ESCPOS
escpos.USB = escposUsb;
escpos.Network = escposNetwork;

export async function printOrderEpson({ orderItems, orderId, table, notes, customer }) {
  // Simulazione/Placeholder per il collegamento alla stampante Epson.
  // Devi configurare se usi USB (new escpos.USB()) o LAN (new escpos.Network('192.168.1.X'))
  console.log('--- STAMPA EPSON IN CORSO ---');
  console.log(`Ordine #${orderId} - Tavolo: ${table}`);
  if (customer) {
    console.log(`Cliente: ${customer.name}`);
    if (customer.phone) console.log(`Tel: ${customer.phone}`);
    if (customer.address) console.log(`Indirizzo: ${customer.address}`);
  }
  orderItems.forEach(item => {
    if (item.isFamily) {
      let mods1 = item.halves && item.halves[0] && item.halves[0].modifiers && item.halves[0].modifiers.length > 0 ? ` (${item.halves[0].modifiers.map(m => m.value).join(', ')})` : '';
      let mods2 = item.halves && item.halves[1] && item.halves[1].modifiers && item.halves[1].modifiers.length > 0 ? ` (${item.halves[1].modifiers.map(m => m.value).join(', ')})` : '';
      let half1 = item.halves && item.halves[0] ? `1/2 ${item.halves[0].name}${mods1}` : '1/2 Vuota';
      let half2 = item.halves && item.halves[1] ? `1/2 ${item.halves[1].name}${mods2}` : '1/2 Vuota';
      let deltaStr = item.manualPriceDelta ? ` (Delta: ${item.manualPriceDelta > 0 ? '+' : ''}${item.manualPriceDelta.toFixed(2)}€)` : '';
      console.log(`- ${item.quantity}x ${item.name} [${half1} | ${half2}]${deltaStr}`);
    } else {
      let mods = item.modifiers && item.modifiers.length > 0 ? ` (${item.modifiers.map(m => m.value).join(', ')})` : '';
      console.log(`- ${item.quantity}x ${item.name}${mods}`);
    }
  });
  if (notes) console.log(`Note: ${notes}`);
  console.log('-----------------------------');

  return new Promise((resolve, reject) => {
    /* 
    SCOMMENTARE E ADATTARE PER LA VERA STAMPA:
    const device  = new escpos.USB(); // O escpos.Network
    const printer = new escpos.Printer(device);

    device.open(function(error) {
      if(error) return reject(error);

      printer
        .font('a')
        .align('ct')
        .style('b')
        .size(1, 1)
        .text('BUONO ORDINE CUCINA')
        .text(`Ordine #${orderId} - Tavolo: ${table}`)
        .text('--------------------------------')
        .align('lt');
      
      orderItems.forEach(item => {
        if (item.isFamily) {
          let mods1 = item.halves && item.halves[0] && item.halves[0].modifiers && item.halves[0].modifiers.length > 0 ? ` (${item.halves[0].modifiers.map(m => m.value).join(', ')})` : '';
          let mods2 = item.halves && item.halves[1] && item.halves[1].modifiers && item.halves[1].modifiers.length > 0 ? ` (${item.halves[1].modifiers.map(m => m.value).join(', ')})` : '';
          let half1 = item.halves && item.halves[0] ? `1/2 ${item.halves[0].name}${mods1}` : '1/2 Vuota';
          let half2 = item.halves && item.halves[1] ? `1/2 ${item.halves[1].name}${mods2}` : '1/2 Vuota';
          printer.text(`${item.quantity}x ${item.name}`);
          printer.text(`   -> [${half1}]`);
          printer.text(`   -> [${half2}]`);
          if (item.manualPriceDelta) printer.text(`   Delta: ${item.manualPriceDelta > 0 ? '+' : ''}${item.manualPriceDelta.toFixed(2)}€`);
        } else {
          let mods = item.modifiers && item.modifiers.length > 0 ? ` (${item.modifiers.map(m => m.value).join(', ')})` : '';
          printer.text(`${item.quantity}x ${item.name}${mods}`);
        }
      });
      
      if (notes) {
        printer.text(' ').text(`NOTE: ${notes}`);
      }
      
      printer
        .cut()
        .close();
      
      resolve(true);
    });
    */
    resolve(true); // Risoluzione mock temporanea
  });
}
