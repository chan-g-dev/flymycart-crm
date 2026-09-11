export const providerCostLabel = (provider) => {
    const name = String(provider || '').trim();
    const canonical = { aramex: 'Aramex', fedex: 'FedEx', fedx: 'FedEx' };
    return `${canonical[name.toLowerCase()] || name || 'Provider'} Cost`;
};
