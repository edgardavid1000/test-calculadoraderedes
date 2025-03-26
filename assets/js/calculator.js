document.addEventListener('DOMContentLoaded', function() {
    const ipForm = document.getElementById('ipForm');
    const ipInput = document.getElementById('ipInput');
    const resultsDiv = document.getElementById('results');

    // Elementos de resultados
    const networkSpan = document.getElementById('network');
    const firstUsableSpan = document.getElementById('firstUsable');
    const ipSpan = document.getElementById('ip');
    const lastUsableSpan = document.getElementById('lastUsable');
    const broadcastSpan = document.getElementById('broadcast');
    const maskSpan = document.getElementById('mask'); // Elemento para mostrar la máscara

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
        } else {
            // Opcional: Limpiar resultados anteriores si hubo un error manejado
            resultsDiv.classList.add('hidden');
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
            mask: '', // Almacena la máscara completa internamente
            cidr: null, // Almacena el valor CIDR internamente
            maskToDisplay: '' // Almacena la cadena que se mostrará en los resultados
        };

        try {
            // Caso 1: Solo CIDR (/24)
            if (input.startsWith('/') && !input.includes('.')) {
                const cidr = parseInt(input.substring(1));
                if (isNaN(cidr) || cidr < 0 || cidr > 32) {
                    throw new Error('Formato CIDR inválido');
                }
                results.mask = cidrToMask(cidr); // Almacena la máscara completa internamente
                results.cidr = cidr; // Almacena el CIDR internamente
                // Formato de despliegue: /CIDR (Máscara Completa)
                results.maskToDisplay = `/${cidr} (${results.mask})`;
                results.network = 'N/A';
                results.firstUsable = 'N/A';
                results.ip = 'N/A';
                results.lastUsable = 'N/A';
                results.broadcast = 'N/A';
                return results;
            }

            // Caso 2: Solo máscara (255.255.255.0)
            if (!input.includes('/') && !input.includes(' ') && isValidIp(input) && isValidMask(input)) {
                const cidr = maskToCidr(input);
                results.mask = input; // Almacena la máscara completa internamente
                results.cidr = cidr; // Almacena el CIDR internamente
                // Formato de despliegue: Máscara Completa (/CIDR)
                results.maskToDisplay = `${results.mask} (/${cidr})`;
                results.network = 'N/A';
                results.firstUsable = 'N/A';
                results.ip = 'N/A';
                results.lastUsable = 'N/A';
                results.broadcast = 'N/A';
                return results;
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
                results.cidr = cidr; // Almacena el CIDR internamente
                results.mask = mask; // Almacena la máscara completa internamente
                calculateIpInfo(results, ip, mask, cidr); // Calcula detalles de la red
                // Formato de despliegue: Máscara Completa (/CIDR)
                results.maskToDisplay = `${mask} (/${cidr})`;
            }
            // Caso 4: IP Máscara (192.168.1.0 255.255.255.0)
            else if (input.includes(' ')) {
                const parts = input.split(/\s+/).filter(part => part.length > 0);

                if (parts.length !== 2) {
                    throw new Error('Formato IP Máscara inválido - se esperaban dos partes separadas por espacio');
                }

                const ip = parts[0];
                const mask = parts[1];

                if (!isValidIp(ip) || !isValidMask(mask)) {
                    throw new Error('Formato IP o Máscara inválido');
                }

                const cidr = maskToCidr(mask);
                results.cidr = cidr; // Almacena el CIDR internamente
                results.mask = mask; // Almacena la máscara completa internamente
                calculateIpInfo(results, ip, mask, cidr); // Calcula detalles de la red
                // Formato de despliegue: Máscara Completa (/CIDR)
                results.maskToDisplay = `${mask} (/${cidr})`;
            } else if (isValidIp(input)) {
                // Caso 5: Solo IP
                throw new Error('Formato de entrada inválido. Falta máscara o CIDR.');
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

    // Calcular información de red a partir de IP y máscara (no modifica maskToDisplay)
    function calculateIpInfo(results, ip, mask, cidr) {
        const ipInt = ipToInt(ip);
        const maskInt = ipToInt(mask);
        const networkInt = ipInt & maskInt;
        const broadcastInt = networkInt | (~maskInt >>> 0);

        results.mask = mask;
        results.cidr = cidr;

        if (cidr === 32) {
            results.network = 'No aplica';
            results.firstUsable = ip;
            results.ip = ip;
            results.lastUsable = ip;
            results.broadcast = 'No aplica';
        } else if (cidr === 31) {
            results.network = intToIp(networkInt);
            results.firstUsable = 'No aplica';
            results.ip = ip;
            results.lastUsable = 'No aplica';
            results.broadcast = intToIp(broadcastInt);
        } else {
            results.network = intToIp(networkInt);
            results.firstUsable = (networkInt + 1 < broadcastInt) ? intToIp(networkInt + 1) : 'N/A';
            results.ip = ip;
            results.lastUsable = (broadcastInt - 1 > networkInt) ? intToIp(broadcastInt - 1) : 'N/A';
            results.broadcast = intToIp(broadcastInt);
        }
    }

    // Convertir CIDR a máscara de subred
    function cidrToMask(cidr) {
        if (cidr < 0 || cidr > 32) {
            throw new Error('CIDR inválido: ' + cidr);
        }
        const mask = (cidr === 0) ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
        return intToIp(mask);
    }

    // Convertir máscara a CIDR
    function maskToCidr(mask) {
        if (!isValidMask(mask)) {
            throw new Error('Máscara inválida al convertir a CIDR: ' + mask);
        }
        const maskInt = ipToInt(mask);
        const inverted = (~maskInt) >>> 0;

        if (inverted === 0) return 32;
        if (inverted === 0xFFFFFFFF) return 0;

        if (((inverted + 1) & inverted) !== 0) {
            throw new Error("Máscara inválida (bits no contiguos) al convertir a CIDR: " + mask);
        }

        return 32 - Math.log2(inverted + 1);
    }

    // Convertir IP a entero de 32 bits
    function ipToInt(ip) {
        const octets = ip.split('.');
        if (octets.length !== 4) {
            throw new Error(`Formato IP inválido "${ip}"`);
        }
        return octets.reduce((res, octet) => {
            const val = parseInt(octet);
            if (isNaN(val) || val < 0 || val > 255) {
                throw new Error(`Octeto inválido "${octet}" en la IP "${ip}"`);
            }
            if (octet.length > 1 && octet.startsWith('0')) {
                throw new Error(`Octeto inválido con cero inicial "${octet}" en la IP "${ip}"`);
            }
            return (res << 8) | val;
        }, 0) >>> 0;
    }

    // Convertir entero a formato IP
    function intToIp(int) {
        if (typeof int !== 'number' || isNaN(int)) {
            console.error("intToIp recibió un valor no numérico:", int);
            return "Error";
        }
        return [
            (int >>> 24) & 255,
            (int >>> 16) & 255,
            (int >>> 8) & 255,
            int & 255
        ].join('.');
    }

    // Validar formato de IP (más estricto con ceros a la izquierda)
    function isValidIp(ip) {
        if (typeof ip !== 'string') return false;
        const octets = ip.split('.');
        if (octets.length !== 4) {
            return false;
        }
        return octets.every(octet => {
            if (octet.length > 1 && octet.startsWith('0')) {
                return false;
            }
            const num = parseInt(octet);
            return !isNaN(num) && num >= 0 && num <= 255 && String(num) === octet;
        });
    }

    // Validar formato de máscara
    function isValidMask(mask) {
        if (!isValidIp(mask)) {
            return false;
        }
        try {
            const maskInt = ipToInt(mask);
            const inverted = (~maskInt) >>> 0;
            const plusOne = (inverted + 1) >>> 0;

            if (maskInt === 0 || maskInt === 0xFFFFFFFF) return true;

            return (plusOne & inverted) === 0;

        } catch (e) {
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
        maskSpan.textContent = results.maskToDisplay;

        resultsDiv.classList.remove('hidden');
    }
});

