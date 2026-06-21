const VAULTS_KEY = 'qix_secure_vaults';

export const getAllVaults = () => {
    try {
        const data = localStorage.getItem(VAULTS_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error("Failed to parse vaults", e);
        return {};
    }
};

export const getVault = (roomId) => {
    const vaults = getAllVaults();
    return vaults[roomId] || null;
};

export const saveVault = (roomId, vaultData) => {
    const vaults = getAllVaults();
    vaults[roomId] = {
        ...vaultData,
        lastAccessed: new Date().toISOString()
    };
    localStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
};

export const destroyVault = (roomId) => {
    const vaults = getAllVaults();
    if (vaults[roomId]) {
        delete vaults[roomId];
        localStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
    }
};

export const destroyAllVaults = () => {
    localStorage.removeItem(VAULTS_KEY);
};