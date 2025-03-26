document.addEventListener('DOMContentLoaded', function() {
    const ipForm = document.getElementById('ipForm');
    const ipInput = document.getElementById('ipInput');
    const resultsDiv = document.getElementById('results');
    const visualizationDiv = document.getElementById('visualization');
    const networkDiagram = document.getElementById('network-diagram');

    // Elementos de resultados
    const networkSpan = document.getElementById('network');
    const firstUsableSpan = document.getElementById('firstUsable');
    const ipSpan = document.getElementById('ip');
    const lastUsableSpan = document.getElementById('lastUsable');
    const broadcastSpan = document.getElementById('broadcast');
    const maskSpan = document.getElementById('mask');

    // Escuchar envío del formulario
    ipForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const input = ipInput.value.trim();

        if (!input) {
            alert('Por favor ingrese una dirección IP o máscara de red');
            return;
        }

        // Procesar la entrada y calcular los resultados
        const results = calculateNetwork(input);

        // Mostrar los resultados si son válidos
        if (results) {
            displayResults(results);
            generateVisualization(results);
        } else {
            // Opcional: Limpiar resultados anteriores si hubo un error manejado
             resultsDiv.classList.add('hidden');
             visualizationDiv.classList.add('hidden');
        }
    });

    // Función principal para calcular la información de la red
    function calculateNetwork(input) {
        // Inicializar objeto de resultados
        const results = {
            network: '',
            firstUsable: '',
            ip: '',
            lastUsable: '',
            broadcast: '',
            mask: ''
        };

        try {
            // Caso 1: Solo CIDR (/24)
            if (input.startsWith('/') && !input.includes('.')) { // Asegurarse que no sea una IP con /
                const cidr = parseInt(input.substring(1));
                 if (isNaN(cidr) || cidr < 0 || cidr > 32) {
                    throw new Error('Formato CIDR inválido');
                }
                results.mask = cidrToMask(cidr);
                // Para este caso, solo mostramos la máscara, el resto queda vacío o N/A
                results.network = 'N/A';
                results.firstUsable = 'N/A';
                results.ip = 'N/A';
                results.lastUsable = 'N/A';
                results.broadcast = 'N/A';
                return results; // Devolvemos solo la máscara convertida
            }

            // Caso 2: Solo máscara (255.255.255.0)
            // Verifica si es una IP válida y si cumple el formato de máscara
            if (!input.includes('/') && !input.includes(' ') && isValidIp(input) && isValidMask(input)) {
                 const cidr = maskToCidr(input);
                 results.mask = '/' + cidr;
                 // Para este caso, solo mostramos el CIDR, el resto queda vacío o N/A
                 results.network = 'N/A';
                 results.firstUsable = 'N/A';
                 results.ip = 'N/A';
                 results.lastUsable = 'N/A';
                 results.broadcast = 'N/A';
                 return results; // Devolvemos solo el CIDR
            }

            // Determinar formato de entrada
            // Caso 3: IP/CIDR (192.168.1.0/24)
            if (input.includes('/')) {
                const parts = input.split('/');
                const ip = parts[0];
                const cidrStr = parts[1];

                if (parts.length !== 2 || !isValidIp(ip)) {
                     throw new Error('Formato IP/CIDR inválido');
                }
                const cidr = parseInt(cidrStr);
                if (isNaN(cidr) || cidr < 0 || cidr > 32) {
                    throw new Error('Valor CIDR inválido');
                }

                const mask = cidrToMask(cidr);
                calculateIpInfo(results, ip, mask, cidr);
            }
            // Caso 4: IP Máscara (192.168.1.0 255.255.255.0)
            // CORRECCIÓN: Usar split con regex para manejar múltiples espacios
            else if (input.includes(' ')) {
                const parts = input.split(/\s+/).filter(part => part.length > 0); // Divide por uno o más espacios y filtra vacíos

                if (parts.length !== 2) {
                     throw new Error('Formato IP Máscara inválido - se esperaban dos partes separadas por espacio');
                }

                const ip = parts[0];
                const mask = parts[1];

                if (!isValidIp(ip) || !isValidMask(mask)) {
                    throw new Error('Formato IP o Máscara inválido');
                }

                const cidr = maskToCidr(mask);
                calculateIpInfo(results, ip, mask, cidr);
                 // CORRECCIÓN: Mostrar máscara como /CIDR en los resultados para este caso
                 results.mask = '/' + cidr;
            } else if (isValidIp(input)) {
                 // Caso 5: Solo IP (asumir /32 o mostrar error?)
                 // Por ahora, lo trataremos como inválido si no tiene máscara/cidr
                 throw new Error('Formato de entrada inválido. Falta máscara o CIDR.');
                 // Alternativa: Asumir /32
                 // const cidr = 32;
                 // const mask = '255.255.255.255';
                 // calculateIpInfo(results, input, mask, cidr);

            } else {
                throw new Error('Formato de entrada inválido');
            }

            return results;

        } catch (error) {
            alert('Error en el cálculo: ' + error.message);
            console.error(error);
            return null; // Devolver null para indicar error
        }
    }

    // Calcular información de red a partir de IP y máscara
    function calculateIpInfo(results, ip, mask, cidr) {
        const ipInt = ipToInt(ip);
        const maskInt = ipToInt(mask);
        const networkInt = ipInt & maskInt;
        // CORRECCIÓN: Calcular broadcast basado en la red, no en la IP de entrada
        // Usar >>> 0 para asegurar operación sin signo
        const broadcastInt = networkInt | (~maskInt >>> 0);

        // Establecer la máscara consistentemente como /CIDR o la máscara completa
        // La decisión de mostrar /CIDR o la máscara completa puede variar.
        // Mantendremos la lógica original aquí, pero la ajustaremos para el caso "IP Mask" después.
        results.mask = (cidr !== undefined) ? '/' + cidr : mask; // Mantener esto por ahora, se sobrescribe si es necesario

        if (cidr === 32) {
            results.network = 'No aplica';
            results.firstUsable = ip; // La única IP usable es ella misma
            results.ip = ip;
            results.lastUsable = ip; // La única IP usable es ella misma
            results.broadcast = 'No aplica';
            results.mask = '/32'; // Asegurar formato /CIDR
        } else if (cidr === 31) {
            results.network = intToIp(networkInt); // La primera IP del par
            results.firstUsable = 'No aplica'; // No hay IPs usables distintas a las de red/broadcast
            // CORRECCIÓN: Establecer IP como 'No aplica' según la expectativa del usuario
            results.ip = 'No aplica';
            results.lastUsable = 'No aplica'; // No hay IPs usables distintas a las de red/broadcast
            results.broadcast = intToIp(broadcastInt); // La segunda IP del par
            results.mask = '/31'; // Asegurar formato /CIDR
        } else {
            // Caso general (CIDR 0 a 30)
            results.network = intToIp(networkInt);
            // CORRECCIÓN: Asegurar que networkInt + 1 no exceda broadcastInt - 1
            results.firstUsable = (networkInt + 1 < broadcastInt) ? intToIp(networkInt + 1) : 'N/A';
            results.ip = ip; // La IP específica proporcionada
            // CORRECCIÓN: Asegurar que broadcastInt - 1 no sea menor que networkInt + 1
            results.lastUsable = (broadcastInt - 1 > networkInt) ? intToIp(broadcastInt - 1) : 'N/A';
            results.broadcast = intToIp(broadcastInt);
            // La máscara ya está establecida antes del if/else if
        }
    }

    // Convertir CIDR a máscara de subred
    function cidrToMask(cidr) {
        if (cidr < 0 || cidr > 32) {
            throw new Error('CIDR inválido: ' + cidr);
        }
        // Crear máscara a partir del CIDR usando desplazamiento de bits
        // (0xFFFFFFFF << (32 - cidr)) maneja el caso cidr=0 correctamente (resulta en 0)
        // >>> 0 asegura que el resultado sea un entero sin signo de 32 bits
        const mask = (cidr === 0) ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
        return intToIp(mask);
    }

    // Convertir máscara a CIDR
    function maskToCidr(mask) {
        if (!isValidMask(mask)) { // Re-valida por si acaso
            throw new Error('Máscara inválida al convertir a CIDR: ' + mask);
        }
        const maskInt = ipToInt(mask);

        // Contar los bits '1' iniciales
        let cidr = 0;
        let tempMask = maskInt;
        while (tempMask & 0x80000000) { // Mientras el bit más significativo sea 1
            cidr++;
            tempMask <<= 1; // Desplaza a la izquierda
        }
         // Validar que el resto sean ceros (ya hecho en isValidMask, pero doble check)
         if ((tempMask & 0xFFFFFFFF) !== 0 && cidr !== 0) {
              // Esto no debería ocurrir si isValidMask es correcto
              console.warn("Inconsistencia detectada al convertir máscara a CIDR:", mask);
         }

        // Corrección alternativa y más simple para contar bits:
        let count = 0;
        let intRepresentation = ipToInt(mask);
        while (intRepresentation) {
            intRepresentation = intRepresentation & (intRepresentation - 1); // Limpia el bit '1' menos significativo
            count++;
        }
        // Sin embargo, la validación de máscara contigua es crucial, así que isValidMask es necesario.
        // El método de contar bits '1' directamente funciona si asumimos que la máscara ya es válida.

        // Usaremos la lógica original basada en la propiedad de las máscaras válidas
         const inverted = (~maskInt) >>> 0;
         // El número de ceros es log2(inverted + 1)
         // El número de unos (CIDR) es 32 - número de ceros
         // Math.log2(0) es -Infinity, Math.log2(1) es 0.
         if (inverted === 0) return 32; // Máscara 255.255.255.255
         if (inverted === 0xFFFFFFFF) return 0; // Máscara 0.0.0.0

         // Verificar que inverted + 1 sea potencia de 2
         if (((inverted + 1) & inverted) !== 0) {
              throw new Error("Máscara inválida (bits no contiguos) al convertir a CIDR: " + mask);
         }

         return 32 - Math.log2(inverted + 1);
    }

    // Convertir IP a entero de 32 bits
    function ipToInt(ip) {
        const octets = ip.split('.');
        if (octets.length !== 4) {
            // No lanzar error aquí, isValidIp ya lo hace. Devolver NaN o 0?
            // Devolver NaN es más explícito de un fallo.
            return NaN;
        }
        // Usar >>> 0 para asegurar que el resultado sea tratado como sin signo
        return octets.reduce((res, octet) => {
             const val = parseInt(octet);
             // Validar cada octeto durante la conversión
             if (isNaN(val) || val < 0 || val > 255) {
                 // Lanzar error si un octeto es inválido
                 throw new Error(`Octeto inválido "${octet}" en la IP "${ip}"`);
             }
             return (res << 8) | val;
        }, 0) >>> 0;
    }

    // Convertir entero a formato IP
    function intToIp(int) {
        // Asegurarse que el input es un número
        if (typeof int !== 'number' || isNaN(int)) {
            console.error("intToIp recibió un valor no numérico:", int);
            return "Error";
        }
        // Usar desplazamientos y máscaras para extraer octetos
        return [
            (int >>> 24) & 255,
            (int >>> 16) & 255,
            (int >>> 8) & 255,
            int & 255
        ].join('.');
    }

    // Validar formato de IP
    function isValidIp(ip) {
        if (typeof ip !== 'string') return false;
        const octets = ip.split('.');
        if (octets.length !== 4) {
            return false;
        }
        return octets.every(octet => {
            // Permitir ceros a la izquierda? No, estándar es sin ceros a la izquierda (excepto '0')
            if (octet.length > 1 && octet.startsWith('0')) {
                 return false;
            }
            const num = parseInt(octet);
            // isNaN chequea si no es número, num >= 0 y num <= 255 chequean el rango
            return !isNaN(num) && num >= 0 && num <= 255 && String(num) === octet; // String(num) === octet previene "1e1" etc.
        });
    }

    // Validar formato de máscara
    function isValidMask(mask) {
        if (!isValidIp(mask)) {
            return false;
        }
        try {
            const maskInt = ipToInt(mask);
            // Una máscara válida tiene bits '1' contiguos seguidos de bits '0' contiguos.
            // Invertir los bits (~maskInt) resulta en '0's contiguos seguidos de '1's contiguos.
            // Sumar 1 a esto ((~maskInt) + 1) debería dar una potencia de 2 (o 0 si maskInt era 0xFFFFFFFF).
            // Una potencia de 2 tiene solo un bit '1'.
            // La comprobación (x & (x - 1)) === 0 es verdadera si x es una potencia de 2 o 0.
            const inverted = (~maskInt) >>> 0;
            const plusOne = (inverted + 1) >>> 0;

            // Casos especiales:
            if (maskInt === 0) return true; // 0.0.0.0 es válida (/0)
            if (maskInt === 0xFFFFFFFF) return true; // 255.255.255.255 es válida (/32)

            // Comprobar si plusOne es potencia de 2
            // (plusOne & inverted) === 0 es equivalente a (plusOne & (plusOne - 1)) === 0 para números > 0
            return (plusOne & inverted) === 0;

        } catch (e) {
             // Si ipToInt falla (ej. por octeto inválido), no es una máscara válida
             return false;
        }
    }

    // Mostrar resultados en la interfaz
    function displayResults(results) {
        networkSpan.textContent = results.network;
        firstUsableSpan.textContent = results.firstUsable;
        ipSpan.textContent = results.ip;
        lastUsableSpan.textContent = results.lastUsable;
        broadcastSpan.textContent = results.broadcast;
        maskSpan.textContent = results.mask; // Ya debería estar en el formato deseado

        resultsDiv.classList.remove('hidden');
        visualizationDiv.classList.remove('hidden');
    }

    // Generar visualización de la red (sin cambios respecto al original)
    function generateVisualization(results) {
        let html = '';
        const maskValue = results.mask; // Puede ser /CIDR o IP
        let cidr = -1;

        if (maskValue.startsWith('/')) {
            cidr = parseInt(maskValue.substring(1));
        } else if (isValidMask(maskValue)) {
             try {
                 cidr = maskToCidr(maskValue);
             } catch (e) {
                 console.error("Error al obtener CIDR para visualización:", e);
                 cidr = -1; // Marcar como inválido si falla
             }
        }

        // Solo generar visualización si tenemos un CIDR válido
        if (cidr !== -1) {
            if (cidr === 32) {
                 // Caso /32 - host único
                html = `
                    <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                        <!-- Rectángulo de host único -->
                        <rect x="200" y="50" width="200" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2"/>
                        <text x="300" y="75" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">Host Único</text>
                        <text x="300" y="95" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">${results.ip}</text>

                        <!-- Máscara de red -->
                        <text x="300" y="130" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${results.mask}</text>
                    </svg>
                `;
            } else if (cidr === 31) {
                 // Caso /31 - red punto a punto
                html = `
                    <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                        <!-- Visualización de red punto a punto -->
                        <rect x="150" y="50" width="120" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2"/>
                        <text x="210" y="75" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">IP 1</text>
                        <text x="210" y="95" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">${results.network}</text>

                        <line x1="270" y1="75" x2="330" y2="75" stroke="#0f172a" stroke-width="2" stroke-dasharray="5,5"/>

                        <rect x="330" y="50" width="120" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2"/>
                        <text x="390" y="75" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">IP 2</text>
                        <text x="390" y="95" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">${results.broadcast}</text>

                        <!-- Máscara de red -->
                        <text x="300" y="130" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${results.mask} (Punto a Punto)</text>
                    </svg>
                `;
            } else if (cidr >= 0 && cidr <= 30) {
                 // Caso general
                 const numHosts = Math.pow(2, 32 - cidr) - 2;
                 html = `
                    <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                        <!-- Rectángulo de red -->
                        <rect x="50" y="20" width="500" height="110" fill="#e6f2ff" stroke="#3b82f6" stroke-width="2"/>

                        <!-- Dirección de red -->
                        <rect x="60" y="30" width="100" height="40" fill="#3b82f6" stroke="#2563eb" stroke-width="1"/>
                        <text x="110" y="50" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Red</text>
                        <text x="110" y="65" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${results.network}</text>

                        <!-- Primera IP útil -->
                        <rect x="170" y="30" width="100" height="40" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
                        <text x="220" y="50" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Primera IP</text>
                        <text x="220" y="65" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${results.firstUsable}</text>

                        <!-- IP indicada (si aplica) -->
                        ${results.ip !== 'N/A' && results.ip !== 'No aplica' ? `
                        <rect x="280" y="30" width="100" height="40" fill="#93c5fd" stroke="#2563eb" stroke-width="1"/>
                        <text x="330" y="50" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">IP Dada</text>
                        <text x="330" y="65" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${results.ip}</text>
                        ` : `
                        <text x="330" y="55" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#6b7280">(IP no aplicable)</text>
                        `}


                        <!-- Última IP útil -->
                        <rect x="390" y="30" width="100" height="40" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
                        <text x="440" y="50" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Última IP</text>
                        <text x="440" y="65" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${results.lastUsable}</text>

                        <!-- Broadcast -->
                        <rect x="280" y="80" width="100" height="40" fill="#3b82f6" stroke="#2563eb" stroke-width="1"/>
                        <text x="330" y="100" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Broadcast</text>
                        <text x="330" y="115" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${results.broadcast}</text>

                        <!-- Máscara de red -->
                        <text x="110" y="105" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${results.mask}</text>

                        <!-- Número de hosts -->
                        <text x="440" y="105" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">
                            Hosts: ${numHosts >= 0 ? numHosts : 'N/A'}
                        </text>
                    </svg>
                `;
            } else {
                 // Caso donde solo se ingresó máscara o CIDR, o hubo error
                 html = `<p style="text-align: center; color: #6b7280;">Visualización no disponible para esta entrada.</p>`;
            }
        } else {
             html = `<p style="text-align: center; color: #ef4444;">Error al determinar CIDR para la visualización.</p>`;
        }


        // Insertar en el div de visualización
        networkDiagram.innerHTML = html;
    }
});
