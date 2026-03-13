const cachedErrorArray = ["id5-sync.com",null,1773411352766,null,null,null,null,null,null,[106]];
const networkSuccessArray = ["id5-sync.com","ID5*s3LJK...",1773411352766,null,null,null,null,null,null,null];

function parseArray(parsedArr) {
    if (Array.isArray(parsedArr)) {
        if (parsedArr.length >= 2 && typeof parsedArr[0] === 'string' && !Array.isArray(parsedArr[1])) {
            parsedArr = [parsedArr];
        }
        
        return parsedArr.map(signalObj => {
            if (Array.isArray(signalObj) && signalObj.length >= 2) {
               let providerValue = signalObj[0];
               let payloadValue = signalObj[1];
               
               let providerName = String(providerValue);
               
               let extractedError = null;
               if (signalObj.length >= 3) {
                   extractedError = signalObj[2]; // Fallback to index 2
                   if (signalObj.length > 8) {
                        let errContainer = signalObj[9];
                        if (Array.isArray(errContainer) && errContainer.length > 0) extractedError = errContainer[0];
                        else if (typeof errContainer === 'number') extractedError = errContainer;
                   }
               }
               
               let finalPayload = payloadValue;
               if (typeof payloadValue === 'string') {
                   try {
                       let innerB64 = payloadValue.replace(/-/g, '+').replace(/_/g, '/');
                       while (innerB64.length % 4) innerB64 += '=';
                       let innerDecoded = atob(innerB64);
                       finalPayload = JSON.parse(innerDecoded);
                   } catch(e) {}
               }
               return {
                   provider: providerName,
                   payload: finalPayload,
                   error: extractedError
               };
            }
            return signalObj;
        });
    }
}

console.log("Cached Error Result:", parseArray(cachedErrorArray));
console.log("Network Success Result:", parseArray(networkSuccessArray));
