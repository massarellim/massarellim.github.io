import escpos from 'escpos';
import escposUsb from 'escpos-usb';
import escposNetwork from 'escpos-network';

// Registrazione degli adapter in ESCPOS
escpos.USB = escposUsb;
escpos.Network = escposNetwork;

export async function printOrderEpson({ orderItems, orderId, table, notes }) {
  // Simulazione/Placeholder per il collegamento alla stampante Epson.
  // Devi configurare se usi USB (new escpos.USB()) o LAN (new escpos.Network('192.168.1.X'))
  console.log('--- STAMPA EPSON IN CORSO ---');
  console.log(`Ordine #${orderId} - Tavolo: ${table}`);
  orderItems.forEach(item => {
    console.log(`- ${item.quantity}x ${item.name} `);
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
        printer.text(`${item.quantity}x ${item.name}`);
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
