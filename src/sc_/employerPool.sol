// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}


struct Payment {
    address worker;
    uint256 amount;
}

contract EmployerPool {
    IERC20 private token;
    address private owner;
    mapping(address => uint256) public balances;

    constructor(address _token) {
        owner = msg.sender;
        token = IERC20(_token);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    function changeOwner(address newOwner) public onlyOwner {
        owner = newOwner;
    }

    function deposit(uint256 amount) public returns (bool) {
        require(token.balanceOf(msg.sender) >= amount, "Insufficient token balance");
        require(token.transferFrom(msg.sender, address(this), amount), "Token transfer failed");
        balances[msg.sender] += amount;
        return true;
    }

    function payWorkers(Payment[] calldata payments, uint256 total) public returns (bool) {
        uint256 bal = balances[msg.sender];
        require(total <= bal, "Insufficient balance");

        uint256 newBal = bal;
        for (uint256 i = 0; i < payments.length; i++) {
            if (newBal < payments[i].amount) {
                continue;
            }
            require(token.transfer(payments[i].worker, payments[i].amount), "Token transfer failed");
            newBal -= payments[i].amount;
        }
        balances[msg.sender] = newBal;
        return true;
    }

    function autoPayWorkers(address employer, Payment[] calldata payments, uint256 total) public onlyOwner returns (bool) {
        uint256 bal = balances[employer];
        require(total <= bal, "Insufficient balance");

        uint256 newBal = bal;
        for (uint256 i = 0; i < payments.length; i++) {
            if (newBal < payments[i].amount) {
                continue;
            }
            require(token.transfer(payments[i].worker, payments[i].amount), "Token transfer failed");
            newBal -= payments[i].amount;
        }
        balances[employer] = newBal;
        return true;
    }

    function transferByEmployer(address recipient, uint256 amount) public returns (bool) {
        uint256 bal = balances[msg.sender];
        require(amount <= bal, "Insufficient balance");
        require(token.transfer(recipient, amount), "Token transfer failed");
        balances[msg.sender] = bal - amount;
        return true;
    }

    function emergencyWithdraw(address employer, uint256 amount) public onlyOwner returns (bool) {
        uint256 bal = balances[employer];
        require(amount <= bal, "Insufficient balance");
        require(token.transfer(owner, amount), "Token transfer failed");
        balances[employer] = bal - amount;
        return true;
    }

    //employer only
    function employerBalance(address employer) public view returns (uint256) {
        return balances[employer];
    }


    //worker balance ...
    function myBalance() public view returns (uint256) {
        return balances[msg.sender];
    }

    function tokenBalance(address _user) public view returns (uint256) {
        return token.balanceOf(_user);
    }
}
