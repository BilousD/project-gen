// transform string to camel case
const camelize = (string) => {
    return string.replace(/[^a-zA-Z0-9]+(.)/g, (m,chr) => chr.toUpperCase());
}
// transform string to kebab case
const kebabise = (string) => {
    return string && string.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
        .map(x => x.toLowerCase())
        .join('-');
}
// first letter upper case
const fUpper = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
exports.camelize = camelize;
exports.kebabise = kebabise;
exports.fupper = fUpper;
